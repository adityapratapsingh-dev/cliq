import { DEFAULT_SETTINGS, ApiError } from "@/types/cliq";
import type {
  Comment,
  ConversationSummary,
  FriendGraph,
  Friendship,
  Message,
  MessageReaction,
  Poll,
  Post,
  PostType,
  PublicUser,
  ReactionType,
  Settings,
} from "@/types/cliq";
import { query, queryOne, withTransaction } from "@/lib/neon";
import { ensureTablesExist } from "@/lib/neon-bootstrap";
import {
  toPublicUser,
  type CreateCommentInput,
  type CreateMessageInput,
  type CreateNotificationInput,
  type CreatePostInput,
  type CreateUserInput,
  type NotificationItem,
  type Store,
  type StoredUser,
  type UpdateUserPatch,
} from "@/lib/store/types";

/* ------------------------------------------------------------------ row types */

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  password_hash: string;
  age: number | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  interests: string[] | null;
  settings: Partial<Settings> | null;
  created_at: Date | string;
}

interface PostRow {
  id: string;
  user_id: string;
  type: string;
  content: string | null;
  media_url: string | null;
  flair: string | null;
  poll_data: PollData | null;
  likes_count: number;
  dislikes_count: number;
  upgrades_count: number;
  downgrades_count: number;
  created_at: Date | string;
  comment_count?: string | number;
  my_reaction?: string | null;
  author?: UserRow | null;
}

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: Date | string;
  author?: UserRow | null;
}

interface MessageRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  media_url: string | null;
  reply_to_id: string | null;
  reactions: { userId: string; emoji: string }[] | null;
  is_read: boolean;
  created_at: Date | string;
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: string;
  created_at: Date | string;
}

interface PollData {
  options: { id: string; text: string; votes: number }[];
  votes: Record<string, string>;
}

/* --------------------------------------------------------------------- helpers */

/** Postgres returns Date objects; the API contract uses ISO strings. */
function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowToUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email ?? "",
    passwordHash: row.password_hash,
    age: row.age,
    bio: row.bio ?? "",
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url,
    interests: Array.isArray(row.interests) ? row.interests : [],
    settings: { ...DEFAULT_SETTINGS, ...(row.settings ?? {}) },
    createdAt: iso(row.created_at),
  };
}

/**
 * Columns to select for an author, as a json_build_object so a post row can
 * carry its author in a single round-trip instead of a second query.
 */
const AUTHOR_JSON = `
  json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'email', u.email,
    'password_hash', '',
    'age', u.age,
    'bio', u.bio,
    'avatar_url', u.avatar_url,
    'banner_url', u.banner_url,
    'interests', u.interests,
    'settings', u.settings,
    'created_at', u.created_at
  ) AS author`;

function pollFromRow(data: PollData | null, viewerId: string): Poll | null {
  if (!data) return null;
  return {
    options: (data.options ?? []).map((o) => ({ id: o.id, text: o.text, votes: Number(o.votes) || 0 })),
    votedOptionId: data.votes?.[viewerId] ?? null,
  };
}

function decoratePost(row: PostRow, viewerId: string): Post {
  const author = row.author ? rowToUser(row.author) : null;
  return {
    id: row.id,
    userId: row.user_id,
    author: author ? toPublicUser(author) : null,
    type: row.type as PostType,
    content: row.content ?? "",
    mediaUrl: row.media_url,
    flair: row.flair,
    flairColor: null,
    poll: pollFromRow(row.poll_data, viewerId),
    likesCount: Number(row.likes_count) || 0,
    dislikesCount: Number(row.dislikes_count) || 0,
    upgradesCount: Number(row.upgrades_count) || 0,
    downgradesCount: Number(row.downgrades_count) || 0,
    commentCount: Number(row.comment_count) || 0,
    myReaction: (row.my_reaction as ReactionType | null) ?? null,
    createdAt: iso(row.created_at),
  };
}

function decorateMessage(row: MessageRow, viewerId: string, parents: Map<string, MessageRow>): Message {
  const raw = Array.isArray(row.reactions) ? row.reactions : [];
  const counts = new Map<string, number>();
  for (const r of raw) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  const reactions: MessageReaction[] = [...counts.entries()].map(([emoji, count]) => ({
    emoji,
    count,
    mine: raw.some((r) => r.emoji === emoji && r.userId === viewerId),
  }));

  let replyTo: Message["replyTo"] = null;
  if (row.reply_to_id) {
    const parent = parents.get(row.reply_to_id);
    if (parent) replyTo = { id: parent.id, content: parent.content ?? "", senderId: parent.sender_id };
  }

  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    content: row.content ?? "",
    mediaUrl: row.media_url,
    replyToId: row.reply_to_id,
    replyTo,
    reactions,
    isRead: Boolean(row.is_read),
    createdAt: iso(row.created_at),
    fromMe: row.sender_id === viewerId,
  };
}

const REACTION_COLUMN: Record<ReactionType, string> = {
  like: "likes_count",
  dislike: "dislikes_count",
  upgrade: "upgrades_count",
  downgrade: "downgrades_count",
};

/* ----------------------------------------------------------------------- store */

export class NeonStore implements Store {
  readonly kind = "neon" as const;

  private ready(): Promise<void> {
    return ensureTablesExist();
  }

  /* ------------------------------------------------------------------ users */

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    await this.ready();
    const username = input.username.toLowerCase();
    const existing = await queryOne<{ id: string }>("SELECT id FROM users WHERE lower(username) = $1", [username]);
    if (existing) throw new ApiError(409, "That @username is already taken.");

    const row = await queryOne<UserRow>(
      `INSERT INTO users
         (id, username, display_name, email, password_hash, age, bio, avatar_url, banner_url, interests, settings, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12)
       RETURNING *`,
      [
        input.id,
        username,
        input.displayName,
        input.email,
        input.passwordHash,
        input.age,
        input.bio,
        input.avatarUrl,
        input.bannerUrl,
        JSON.stringify(input.interests),
        JSON.stringify(input.settings),
        input.createdAt,
      ],
    );
    if (!row) throw new ApiError(500, "Failed to create user.");
    return rowToUser(row);
  }

  async getUserById(id: string): Promise<StoredUser | null> {
    await this.ready();
    const row = await queryOne<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
    return row ? rowToUser(row) : null;
  }

  async getUserByUsername(username: string): Promise<StoredUser | null> {
    await this.ready();
    const row = await queryOne<UserRow>("SELECT * FROM users WHERE lower(username) = lower($1)", [username]);
    return row ? rowToUser(row) : null;
  }

  async listUsers(excludeId: string): Promise<StoredUser[]> {
    await this.ready();
    const rows = await query<UserRow>("SELECT * FROM users WHERE id <> $1 ORDER BY lower(username) ASC", [excludeId]);
    return rows.map(rowToUser);
  }

  async updateUser(id: string, patch: UpdateUserPatch): Promise<StoredUser> {
    await this.ready();
    // Build the SET list from the keys actually provided, so a partial patch
    // never nulls out a column the caller did not mention.
    const sets: string[] = [];
    const params: unknown[] = [];

    const push = (column: string, value: unknown, cast = "") => {
      params.push(value);
      sets.push(`${column} = $${params.length}${cast}`);
    };

    if (patch.displayName !== undefined) push("display_name", patch.displayName);
    if (patch.bio !== undefined) push("bio", patch.bio);
    if (patch.age !== undefined) push("age", patch.age);
    if (patch.avatarUrl !== undefined) push("avatar_url", patch.avatarUrl);
    if (patch.bannerUrl !== undefined) push("banner_url", patch.bannerUrl);
    if (patch.interests !== undefined) push("interests", JSON.stringify(patch.interests), "::jsonb");
    if (patch.settings !== undefined) push("settings", JSON.stringify(patch.settings), "::jsonb");

    if (sets.length === 0) {
      const current = await this.getUserById(id);
      if (!current) throw new ApiError(404, "User not found.");
      return current;
    }

    params.push(id);
    const row = await queryOne<UserRow>(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!row) throw new ApiError(404, "User not found.");
    return rowToUser(row);
  }

  /* ------------------------------------------------------------------ posts */

  async listPosts(type: PostType, viewerId: string): Promise<Post[]> {
    await this.ready();
    const rows = await query<PostRow>(
      `SELECT p.*, ${AUTHOR_JSON},
              (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
              (SELECT reaction_type FROM post_reactions r WHERE r.post_id = p.id AND r.user_id = $2) AS my_reaction
       FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.type = $1
       ORDER BY p.created_at DESC`,
      [type, viewerId],
    );
    return rows.map((row) => decoratePost(row, viewerId));
  }

  async getPost(id: string, viewerId: string): Promise<Post | null> {
    await this.ready();
    const row = await queryOne<PostRow>(
      `SELECT p.*, ${AUTHOR_JSON},
              (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
              (SELECT reaction_type FROM post_reactions r WHERE r.post_id = p.id AND r.user_id = $2) AS my_reaction
       FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`,
      [id, viewerId],
    );
    return row ? decoratePost(row, viewerId) : null;
  }

  async createPost(input: CreatePostInput): Promise<Post> {
    await this.ready();
    const pollData: PollData | null = input.pollOptions?.length
      ? { options: input.pollOptions.map((o) => ({ ...o, votes: 0 })), votes: {} }
      : null;

    await query(
      `INSERT INTO posts (id, user_id, type, content, media_url, flair, poll_data, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
      [
        input.id,
        input.userId,
        input.type,
        input.content,
        input.mediaUrl,
        input.flair,
        pollData ? JSON.stringify(pollData) : null,
        input.createdAt,
      ],
    );
    const post = await this.getPost(input.id, input.userId);
    if (!post) throw new ApiError(500, "Failed to create post.");
    return post;
  }

  async deletePost(id: string, userId: string): Promise<boolean> {
    await this.ready();
    const row = await queryOne<{ user_id: string }>("SELECT user_id FROM posts WHERE id = $1", [id]);
    if (!row) return false;
    if (row.user_id !== userId) throw new ApiError(403, "You can only delete your own posts.");
    // Children cascade via the foreign keys.
    await query("DELETE FROM posts WHERE id = $1", [id]);
    return true;
  }

  async setPostReaction(postId: string, userId: string, type: ReactionType): Promise<Post> {
    await this.ready();
    const existingPost = await queryOne<{ id: string }>("SELECT id FROM posts WHERE id = $1", [postId]);
    if (!existingPost) throw new ApiError(404, "Post not found.");

    const previous = await queryOne<{ reaction_type: string }>(
      "SELECT reaction_type FROM post_reactions WHERE post_id = $1 AND user_id = $2",
      [postId, userId],
    );

    await withTransaction(async (client) => {
      if (previous) {
        const prevColumn = REACTION_COLUMN[previous.reaction_type as ReactionType];
        if (prevColumn) {
          await client.query(
            `UPDATE posts SET ${prevColumn} = GREATEST(0, ${prevColumn} - 1) WHERE id = $1`,
            [postId],
          );
        }
        await client.query("DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2", [postId, userId]);
      }

      // Clicking the same reaction again removes it (toggle off).
      if (!previous || previous.reaction_type !== type) {
        await client.query(
          "INSERT INTO post_reactions (id, post_id, user_id, reaction_type, created_at) VALUES ($1,$2,$3,$4,now())",
          [`pr_${postId}_${userId}`, postId, userId, type],
        );
        await client.query(`UPDATE posts SET ${REACTION_COLUMN[type]} = ${REACTION_COLUMN[type]} + 1 WHERE id = $1`, [
          postId,
        ]);
      }
    });

    const post = await this.getPost(postId, userId);
    if (!post) throw new ApiError(404, "Post not found.");
    return post;
  }

  async votePoll(postId: string, userId: string, optionId: string): Promise<Post> {
    await this.ready();
    const row = await queryOne<{ poll_data: PollData | null }>("SELECT poll_data FROM posts WHERE id = $1", [postId]);
    if (!row) throw new ApiError(404, "Post not found.");
    const data = row.poll_data;
    if (!data) throw new ApiError(404, "This post has no poll.");

    const previous = data.votes?.[userId];
    if (previous !== optionId) {
      if (previous) {
        const prevOption = data.options.find((o) => o.id === previous);
        if (prevOption) prevOption.votes = Math.max(0, Number(prevOption.votes) - 1);
      }
      const option = data.options.find((o) => o.id === optionId);
      if (!option) throw new ApiError(400, "Unknown poll option.");
      option.votes = (Number(option.votes) || 0) + 1;
      data.votes = { ...(data.votes ?? {}), [userId]: optionId };
      await query("UPDATE posts SET poll_data = $1::jsonb WHERE id = $2", [JSON.stringify(data), postId]);
    }

    const post = await this.getPost(postId, userId);
    if (!post) throw new ApiError(404, "Post not found.");
    return post;
  }

  /* --------------------------------------------------------------- comments */

  async listComments(postId: string): Promise<Comment[]> {
    await this.ready();
    const rows = await query<CommentRow>(
      `SELECT c.*, ${AUTHOR_JSON}
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [postId],
    );

    const toComment = (row: CommentRow): Comment => {
      const author = row.author ? rowToUser(row.author) : null;
      return {
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        author: author ? toPublicUser(author) : null,
        parentCommentId: row.parent_comment_id,
        content: row.content,
        createdAt: iso(row.created_at),
        replies: [],
      };
    };

    const byId = new Map<string, Comment>();
    for (const row of rows) byId.set(row.id, toComment(row));

    const roots: Comment[] = [];
    for (const row of rows) {
      const comment = byId.get(row.id);
      if (!comment) continue;
      const parent = row.parent_comment_id ? byId.get(row.parent_comment_id) : undefined;
      if (parent) parent.replies.push(comment);
      else roots.push(comment);
    }
    return roots;
  }

  async createComment(input: CreateCommentInput): Promise<Comment> {
    await this.ready();
    const row = await queryOne<CommentRow>(
      `INSERT INTO comments (id, post_id, user_id, parent_comment_id, content, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [input.id, input.postId, input.userId, input.parentCommentId, input.content, input.createdAt],
    );
    if (!row) throw new ApiError(500, "Failed to create comment.");
    const author = await this.getUserById(input.userId);
    return {
      id: row.id,
      postId: row.post_id,
      userId: row.user_id,
      author: author ? toPublicUser(author) : null,
      parentCommentId: row.parent_comment_id,
      content: row.content,
      createdAt: iso(row.created_at),
      replies: [],
    };
  }

  /* ------------------------------------------------------------ friendships */

  async listFriends(userId: string): Promise<FriendGraph> {
    await this.ready();
    const rows = await query<FriendshipRow>(
      "SELECT * FROM friendships WHERE requester_id = $1 OR receiver_id = $1",
      [userId],
    );

    const related = new Set<string>([userId]);
    for (const row of rows) related.add(row.requester_id === userId ? row.receiver_id : row.requester_id);

    const friends: PublicUser[] = [];
    const incoming: FriendGraph["incoming"] = [];
    const outgoing: FriendGraph["outgoing"] = [];

    if (related.size > 1) {
      const ids = [...related].filter((id) => id !== userId);
      const users = await query<UserRow>("SELECT * FROM users WHERE id = ANY($1::text[])", [ids]);
      const byId = new Map(users.map((u) => [u.id, rowToUser(u)]));

      for (const row of rows) {
        const otherId = row.requester_id === userId ? row.receiver_id : row.requester_id;
        const other = byId.get(otherId);
        if (!other) continue;
        const pub = toPublicUser(other);
        if (row.status === "accepted") friends.push(pub);
        else if (row.receiver_id === userId) incoming.push({ id: row.id, user: pub, createdAt: iso(row.created_at) });
        else outgoing.push({ id: row.id, user: pub, createdAt: iso(row.created_at) });
      }
    }

    const suggestedRows = await query<UserRow>(
      "SELECT * FROM users WHERE id <> $1 AND NOT (id = ANY($2::text[])) ORDER BY lower(username) ASC LIMIT 60",
      [userId, [...related]],
    );

    return {
      friends,
      incoming,
      outgoing,
      suggested: suggestedRows.map((r) => toPublicUser(rowToUser(r))),
    };
  }

  async sendFriendRequest(requesterId: string, receiverId: string): Promise<Friendship> {
    await this.ready();
    if (requesterId === receiverId) throw new ApiError(400, "You cannot Cliq Up yourself.");

    const existing = await queryOne<FriendshipRow>(
      `SELECT * FROM friendships
       WHERE (requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1)
       LIMIT 1`,
      [requesterId, receiverId],
    );

    if (existing) {
      if (existing.status === "pending" && existing.receiver_id === requesterId) {
        // They already asked us — accept instead of duplicating.
        await query("UPDATE friendships SET status = 'accepted' WHERE id = $1", [existing.id]);
        return {
          id: existing.id,
          requesterId: existing.requester_id,
          receiverId: existing.receiver_id,
          status: "accepted",
          createdAt: iso(existing.created_at),
        };
      }
      return {
        id: existing.id,
        requesterId: existing.requester_id,
        receiverId: existing.receiver_id,
        status: existing.status as Friendship["status"],
        createdAt: iso(existing.created_at),
      };
    }

    const id = `fr_${requesterId}_${receiverId}`;
    const row = await queryOne<FriendshipRow>(
      `INSERT INTO friendships (id, requester_id, receiver_id, status, created_at)
       VALUES ($1,$2,$3,'pending',now())
       RETURNING *`,
      [id, requesterId, receiverId],
    );
    if (!row) throw new ApiError(500, "Failed to send request.");
    return {
      id: row.id,
      requesterId: row.requester_id,
      receiverId: row.receiver_id,
      status: row.status as Friendship["status"],
      createdAt: iso(row.created_at),
    };
  }

  async respondFriendRequest(friendshipId: string, userId: string, accept: boolean): Promise<Friendship> {
    await this.ready();
    const row = await queryOne<FriendshipRow>("SELECT * FROM friendships WHERE id = $1", [friendshipId]);
    if (!row) throw new ApiError(404, "Friend request not found.");
    if (row.receiver_id !== userId) throw new ApiError(403, "This request is not yours to answer.");

    if (accept) {
      await query("UPDATE friendships SET status = 'accepted' WHERE id = $1", [friendshipId]);
      return {
        id: row.id,
        requesterId: row.requester_id,
        receiverId: row.receiver_id,
        status: "accepted",
        createdAt: iso(row.created_at),
      };
    }
    await query("DELETE FROM friendships WHERE id = $1", [friendshipId]);
    return {
      id: row.id,
      requesterId: row.requester_id,
      receiverId: row.receiver_id,
      status: "pending",
      createdAt: iso(row.created_at),
    };
  }

  /** Real counters for the profile header. */
  async getStats(userId: string): Promise<{ friends: number; following: number; posts: number }> {
    await this.ready();
    const row = await queryOne<{ friends: string; following: string; posts: string }>(
      `SELECT
         (SELECT COUNT(*) FROM friendships
           WHERE status = 'accepted' AND (requester_id = $1 OR receiver_id = $1)) AS friends,
         (SELECT COUNT(*) FROM friendships WHERE requester_id = $1) AS following,
         (SELECT COUNT(*) FROM posts WHERE user_id = $1) AS posts`,
      [userId],
    );
    return {
      friends: Number(row?.friends ?? 0),
      following: Number(row?.following ?? 0),
      posts: Number(row?.posts ?? 0),
    };
  }

  /* --------------------------------------------------------------- messages */

  async listConversations(userId: string): Promise<ConversationSummary[]> {
    await this.ready();
    const rows = await query<MessageRow>(
      "SELECT * FROM messages WHERE sender_id = $1 OR receiver_id = $1 ORDER BY created_at ASC",
      [userId],
    );

    const partners = new Set<string>();
    for (const row of rows) partners.add(row.sender_id === userId ? row.receiver_id : row.sender_id);

    const friendRows = await query<FriendshipRow>(
      "SELECT * FROM friendships WHERE (requester_id = $1 OR receiver_id = $1) AND status = 'accepted'",
      [userId],
    );
    for (const row of friendRows) partners.add(row.requester_id === userId ? row.receiver_id : row.requester_id);

    if (partners.size === 0) return [];

    const users = await query<UserRow>("SELECT * FROM users WHERE id = ANY($1::text[])", [[...partners]]);
    const byId = new Map(users.map((u) => [u.id, rowToUser(u)]));
    const parents = new Map(rows.map((r) => [r.id, r]));

    const summaries: ConversationSummary[] = [];
    for (const partnerId of partners) {
      const partner = byId.get(partnerId);
      if (!partner) continue;
      const thread = rows.filter(
        (r) =>
          (r.sender_id === userId && r.receiver_id === partnerId) ||
          (r.sender_id === partnerId && r.receiver_id === userId),
      );
      const last = thread[thread.length - 1] ?? null;
      summaries.push({
        partner: toPublicUser(partner),
        lastMessage: last ? decorateMessage(last, userId, parents) : null,
        unreadCount: thread.filter((r) => r.receiver_id === userId && !r.is_read).length,
      });
    }

    return summaries.sort((a, b) => (b.lastMessage?.createdAt ?? "").localeCompare(a.lastMessage?.createdAt ?? ""));
  }

  async listMessages(userId: string, partnerId: string): Promise<Message[]> {
    await this.ready();
    const rows = await query<MessageRow>(
      `SELECT * FROM messages
       WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [userId, partnerId],
    );
    const parents = new Map(rows.map((r) => [r.id, r]));
    return rows.map((r) => decorateMessage(r, userId, parents));
  }

  async createMessage(input: CreateMessageInput): Promise<Message> {
    await this.ready();
    const row = await queryOne<MessageRow>(
      `INSERT INTO messages (id, sender_id, receiver_id, content, media_url, reply_to_id, reactions, is_read, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,'[]'::jsonb,false,$7)
       RETURNING *`,
      [input.id, input.senderId, input.receiverId, input.content, input.mediaUrl, input.replyToId, input.createdAt],
    );
    if (!row) throw new ApiError(500, "Failed to send message.");
    const parents = new Map<string, MessageRow>();
    if (row.reply_to_id) {
      const parent = await queryOne<MessageRow>("SELECT * FROM messages WHERE id = $1", [row.reply_to_id]);
      if (parent) parents.set(parent.id, parent);
    }
    return decorateMessage(row, input.senderId, parents);
  }

  async deleteMessage(id: string, userId: string): Promise<boolean> {
    await this.ready();
    const row = await queryOne<{ sender_id: string }>("SELECT sender_id FROM messages WHERE id = $1", [id]);
    if (!row) return false;
    if (row.sender_id !== userId) throw new ApiError(403, "You can only unsend your own messages.");
    await query("DELETE FROM messages WHERE id = $1", [id]);
    return true;
  }

  async setMessageReaction(messageId: string, userId: string, emoji: string): Promise<Message> {
    await this.ready();
    const row = await queryOne<MessageRow>("SELECT * FROM messages WHERE id = $1", [messageId]);
    if (!row) throw new ApiError(404, "Message not found.");

    const raw = Array.isArray(row.reactions) ? [...row.reactions] : [];
    const index = raw.findIndex((r) => r.userId === userId);
    if (index >= 0) {
      if (raw[index].emoji === emoji) raw.splice(index, 1);
      else raw[index].emoji = emoji;
    } else {
      raw.push({ userId, emoji });
    }

    const updated = await queryOne<MessageRow>(
      "UPDATE messages SET reactions = $1::jsonb WHERE id = $2 RETURNING *",
      [JSON.stringify(raw), messageId],
    );
    if (!updated) throw new ApiError(404, "Message not found.");

    const parents = new Map<string, MessageRow>();
    if (updated.reply_to_id) {
      const parent = await queryOne<MessageRow>("SELECT * FROM messages WHERE id = $1", [updated.reply_to_id]);
      if (parent) parents.set(parent.id, parent);
    }
    return decorateMessage(updated, userId, parents);
  }

  async markConversationRead(userId: string, partnerId: string): Promise<void> {
    await this.ready();
    await query("UPDATE messages SET is_read = true WHERE receiver_id = $1 AND sender_id = $2", [userId, partnerId]);
  }

  /* ---------------------------------------------------------- notifications */

  async listNotifications(userId: string): Promise<NotificationItem[]> {
    await this.ready();
    const rows = await query<{
      id: string;
      userId: string;
      kind: string;
      postId: string | null;
      text: string;
      isRead: boolean;
      createdAt: Date | string;
      actor_id: string | null;
      actor_username: string | null;
      actor_display_name: string | null;
      actor_avatar_url: string | null;
    }>(
      `SELECT n.id, n.user_id AS "userId", n.kind, n.post_id AS "postId", n.text,
              n.is_read AS "isRead", n.created_at AS "createdAt",
              a.id AS actor_id, a.username AS actor_username, a.display_name AS actor_display_name,
              a.avatar_url AS actor_avatar_url
       FROM notifications n
       LEFT JOIN users a ON a.id = n.actor_id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId],
    );

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      actor:
        r.actor_id && r.actor_username
          ? {
              id: r.actor_id,
              username: r.actor_username,
              displayName: r.actor_display_name ?? r.actor_username,
              age: null,
              bio: "",
              avatarUrl: r.actor_avatar_url,
              bannerUrl: null,
              interests: [],
              createdAt: iso(r.createdAt),
            }
          : null,
      kind: r.kind,
      postId: r.postId,
      text: r.text,
      isRead: Boolean(r.isRead),
      createdAt: iso(r.createdAt),
    }));
  }

  async createNotification(input: CreateNotificationInput): Promise<NotificationItem> {
    await this.ready();
    await query(
      `INSERT INTO notifications (id, user_id, actor_id, kind, post_id, text, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [input.id, input.userId, input.actorId, input.kind, input.postId, input.text, input.createdAt],
    );
    return {
      id: input.id,
      userId: input.userId,
      actor: null,
      kind: input.kind,
      postId: input.postId,
      text: input.text,
      isRead: false,
      createdAt: input.createdAt,
    };
  }

  async markNotificationsRead(userId: string): Promise<void> {
    await this.ready();
    await query("UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false", [userId]);
  }
}
