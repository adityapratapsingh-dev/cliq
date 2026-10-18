import { DEFAULT_SETTINGS, ApiError } from "@/types/cliq";
import type {
  Comment,
  ConversationSummary,
  FriendGraph,
  Friendship,
  Group,
  GroupMessage,
  Message,
  MessageReaction,
  Poll,
  Post,
  PostType,
  PublicUser,
  ReactionType,
  Settings,
  Story,
  StoryBgStyle,
  StoryGroup,
  StreakInfo,
  UserBadges,
} from "@/types/cliq";
import { d1Batch, d1Query } from "@/lib/d1";
import { ensureTablesExist } from "@/lib/d1-schema";
import {
  toPublicUser,
  type CreateCommentInput,
  type CreateGroupInput,
  type CreateGroupMessageInput,
  type CreateMessageInput,
  type CreateNotificationInput,
  type CreatePostInput,
  type CreateStoryInput,
  type CreateUserInput,
  type NotificationItem,
  type ProfileStats,
  type Store,
  type UnreadCounts,
  type StoredUser,
  type UpdateUserPatch,
} from "@/lib/store/types";
import { buildBadges, computeStreak } from "@/lib/achievements";
import { DEFAULT_LOUNGES, STORY_TTL_MS, groupSeededAt } from "@/lib/social-defaults";

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
  interests: string | null;
  settings: string | null;
  created_at: string;
}

interface PostRow {
  id: string;
  user_id: string;
  type: string;
  content: string | null;
  media_url: string | null;
  flair: string | null;
  poll_data: string | null;
  pinned: number | null;
  quoted_post_id: string | null;
  likes_count: number;
  dislikes_count: number;
  upgrades_count: number;
  downgrades_count: number;
  created_at: string;
  comment_count?: number;
  my_reaction?: string | null;
}

interface StoryRow {
  id: string;
  user_id: string;
  media_url: string | null;
  caption: string | null;
  bg_style: string | null;
  views_count: number;
  created_at: string;
  viewed?: number;
}

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  creator_id: string | null;
  is_public: number | null;
  created_at: string;
  member_count?: number;
  joined?: number;
  last_message_at?: string | null;
}

interface GroupMessageRow {
  id: string;
  group_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  reactions: string | null;
  created_at: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
}

interface MessageRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  media_url: string | null;
  reply_to_id: string | null;
  reactions: string | null;
  is_read: number;
  created_at: string;
}

interface FriendshipRow {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
}

interface PollData {
  options: { id: string; text: string; votes: number }[];
  votes: Record<string, string>;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email ?? "",
    passwordHash: row.password_hash,
    age: row.age ?? null,
    bio: row.bio ?? "",
    avatarUrl: row.avatar_url,
    bannerUrl: row.banner_url,
    interests: parseJson<string[]>(row.interests, []),
    settings: { ...DEFAULT_SETTINGS, ...parseJson<Partial<Settings>>(row.settings, {}) },
    createdAt: row.created_at,
  };
}

export class D1Store implements Store {
  readonly kind = "d1" as const;

  private async ready(): Promise<void> {
    await ensureTablesExist();
  }

  // ---------------------------------------------------------------- users
  async createUser(input: CreateUserInput): Promise<StoredUser> {
    await this.ready();
    const username = input.username.toLowerCase();
    const existing = await this.getUserByUsername(username);
    if (existing) throw new ApiError(409, "That @username is already taken.");

    await d1Query(
      `INSERT INTO users (id, username, display_name, email, password_hash, age, bio, avatar_url, banner_url, interests, settings, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    return { ...input, username };
  }

  async getUserById(id: string): Promise<StoredUser | null> {
    await this.ready();
    const rows = await d1Query<UserRow>("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  async getUserByUsername(username: string): Promise<StoredUser | null> {
    await this.ready();
    const rows = await d1Query<UserRow>("SELECT * FROM users WHERE lower(username) = lower(?) LIMIT 1", [username]);
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  async listUsers(excludeId: string): Promise<StoredUser[]> {
    await this.ready();
    const rows = await d1Query<UserRow>(
      "SELECT * FROM users WHERE id != ? ORDER BY lower(username) ASC",
      [excludeId],
    );
    return rows.map(rowToUser);
  }

  async updateUser(id: string, patch: UpdateUserPatch): Promise<StoredUser> {
    await this.ready();
    const current = await this.getUserById(id);
    if (!current) throw new ApiError(404, "User not found.");

    const next: StoredUser = {
      ...current,
      displayName: patch.displayName !== undefined ? patch.displayName : current.displayName,
      bio: patch.bio !== undefined ? patch.bio : current.bio,
      age: patch.age !== undefined ? patch.age : current.age,
      avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : current.avatarUrl,
      bannerUrl: patch.bannerUrl !== undefined ? patch.bannerUrl : current.bannerUrl,
      interests: patch.interests !== undefined ? patch.interests : current.interests,
      settings: patch.settings !== undefined ? patch.settings : current.settings,
    };

    await d1Query(
      `UPDATE users SET display_name = ?, bio = ?, age = ?, avatar_url = ?, banner_url = ?, interests = ?, settings = ? WHERE id = ?`,
      [
        next.displayName,
        next.bio,
        next.age,
        next.avatarUrl,
        next.bannerUrl,
        JSON.stringify(next.interests),
        JSON.stringify(next.settings),
        id,
      ],
    );
    return next;
  }

  // ---------------------------------------------------------------- posts
  private decoratePost(row: PostRow, author: StoredUser | null, viewerId: string): Post {
    const pollData = parseJson<PollData | null>(row.poll_data, null);
    let poll: Poll | null = null;
    if (pollData) {
      poll = {
        options: pollData.options.map((o) => ({ ...o, votes: Number(o.votes) || 0 })),
        votedOptionId: pollData.votes?.[viewerId] ?? null,
      };
    }
    const reaction = (row.my_reaction as ReactionType | null) ?? null;
    return {
      id: row.id,
      userId: row.user_id,
      author: author ? toPublicUser(author) : null,
      type: row.type as PostType,
      content: row.content ?? "",
      mediaUrl: row.media_url,
      flair: row.flair,
      flairColor: null,
      poll,
      likesCount: Number(row.likes_count) || 0,
      dislikesCount: Number(row.dislikes_count) || 0,
      upgradesCount: Number(row.upgrades_count) || 0,
      downgradesCount: Number(row.downgrades_count) || 0,
      commentCount: Number(row.comment_count) || 0,
      myReaction: reaction,
      pinned: Number(row.pinned) === 1,
      quotedPost: null,
      createdAt: row.created_at,
    };
  }

  /**
   * Resolve the embedded quote previews for a batch of post rows.
   *
   * Fetches every referenced original post and its author in two queries, then
   * returns a map keyed by the *repost's* id.
   */
  private async resolveQuotes(rows: PostRow[]): Promise<Map<string, Post["quotedPost"]>> {
    const map = new Map<string, Post["quotedPost"]>();
    const originals = [...new Set(rows.map((r) => r.quoted_post_id).filter((v): v is string => Boolean(v)))];
    if (originals.length === 0) return map;

    const placeholders = originals.map(() => "?").join(", ");
    const quotedRows = await d1Query<PostRow>(`SELECT * FROM posts WHERE id IN (${placeholders})`, originals);
    const authors = await this.usersByIds([...new Set(quotedRows.map((r) => r.user_id))]);
    const byId = new Map(quotedRows.map((r) => [r.id, r]));

    for (const row of rows) {
      if (!row.quoted_post_id) continue;
      const quoted = byId.get(row.quoted_post_id);
      if (!quoted) continue;
      const author = authors.get(quoted.user_id);
      map.set(row.id, {
        id: quoted.id,
        type: quoted.type as PostType,
        content: quoted.content ?? "",
        mediaUrl: quoted.media_url,
        author: author
          ? { id: author.id, username: author.username, displayName: author.displayName, avatarUrl: author.avatarUrl }
          : null,
        createdAt: quoted.created_at,
      });
    }
    return map;
  }

  /** Decorate a batch of rows with authors + quote previews. */
  private async decoratePosts(rows: PostRow[], viewerId: string): Promise<Post[]> {
    if (rows.length === 0) return [];
    const users = await this.usersByIds([...new Set(rows.map((r) => r.user_id))]);
    const quotes = await this.resolveQuotes(rows);
    return rows.map((row) => ({
      ...this.decoratePost(row, users.get(row.user_id) ?? null, viewerId),
      quotedPost: quotes.get(row.id) ?? null,
    }));
  }

  private async fetchPostRow(id: string, viewerId: string): Promise<PostRow | null> {
    const rows = await d1Query<PostRow>(
      `SELECT p.*,
              (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
              (SELECT reaction_type FROM post_reactions r WHERE r.post_id = p.id AND r.user_id = ?) AS my_reaction
       FROM posts p WHERE p.id = ? LIMIT 1`,
      [viewerId, id],
    );
    return rows[0] ?? null;
  }

  async listPosts(type: PostType, viewerId: string): Promise<Post[]> {
    await this.ready();
    const rows = await d1Query<PostRow>(
      `SELECT p.*,
              (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
              (SELECT reaction_type FROM post_reactions r WHERE r.post_id = p.id AND r.user_id = ?) AS my_reaction
       FROM posts p WHERE p.type = ? ORDER BY p.pinned DESC, p.created_at DESC`,
      [viewerId, type],
    );
    return this.decoratePosts(rows, viewerId);
  }

  private async usersByIds(ids: string[]): Promise<Map<string, StoredUser>> {
    const map = new Map<string, StoredUser>();
    if (ids.length === 0) return map;
    const placeholders = ids.map(() => "?").join(", ");
    const rows = await d1Query<UserRow>(`SELECT * FROM users WHERE id IN (${placeholders})`, ids);
    for (const row of rows) map.set(row.id, rowToUser(row));
    return map;
  }

  async getPost(id: string, viewerId: string): Promise<Post | null> {
    await this.ready();
    const row = await this.fetchPostRow(id, viewerId);
    if (!row) return null;
    const [post] = await this.decoratePosts([row], viewerId);
    return post ?? null;
  }

  async createPost(input: CreatePostInput): Promise<Post> {
    await this.ready();
    const pollData: PollData | null = input.pollOptions?.length
      ? { options: input.pollOptions.map((o) => ({ ...o, votes: 0 })), votes: {} }
      : null;

    await d1Query(
      `INSERT INTO posts (id, user_id, type, content, media_url, flair, poll_data, quoted_post_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.userId,
        input.type,
        input.content,
        input.mediaUrl,
        input.flair,
        pollData ? JSON.stringify(pollData) : null,
        input.quotedPostId ?? null,
        input.createdAt,
      ],
    );
    const post = await this.getPost(input.id, input.userId);
    if (!post) throw new ApiError(500, "Failed to create post.");
    return post;
  }

  async deletePost(id: string, userId: string): Promise<boolean> {
    await this.ready();
    const rows = await d1Query<{ user_id: string }>("SELECT user_id FROM posts WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) return false;
    if (rows[0].user_id !== userId) throw new ApiError(403, "You can only delete your own posts.");
    await d1Batch([
      { sql: "DELETE FROM posts WHERE id = ?", params: [id] },
      { sql: "DELETE FROM post_reactions WHERE post_id = ?", params: [id] },
      { sql: "DELETE FROM comments WHERE post_id = ?", params: [id] },
    ]);
    return true;
  }

  async updatePost(id: string, userId: string, content: string): Promise<Post> {
    await this.ready();
    const rows = await d1Query<{ user_id: string }>("SELECT user_id FROM posts WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) throw new ApiError(404, "Post not found.");
    if (rows[0].user_id !== userId) throw new ApiError(403, "You can only edit your own posts.");
    await d1Query("UPDATE posts SET content = ? WHERE id = ?", [content, id]);
    const post = await this.getPost(id, userId);
    if (!post) throw new ApiError(404, "Post not found.");
    return post;
  }

  async setPostPinned(id: string, userId: string, pinned: boolean): Promise<Post> {
    await this.ready();
    const rows = await d1Query<{ user_id: string }>("SELECT user_id FROM posts WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) throw new ApiError(404, "Post not found.");
    if (rows[0].user_id !== userId) throw new ApiError(403, "You can only pin your own posts.");
    const statements: { sql: string; params?: unknown[] }[] = [];
    if (pinned) {
      statements.push({ sql: "UPDATE posts SET pinned = 0 WHERE user_id = ? AND id <> ?", params: [userId, id] });
    }
    statements.push({ sql: "UPDATE posts SET pinned = ? WHERE id = ?", params: [pinned ? 1 : 0, id] });
    await d1Batch(statements);
    const post = await this.getPost(id, userId);
    if (!post) throw new ApiError(404, "Post not found.");
    return post;
  }

  async setPostReaction(postId: string, userId: string, type: ReactionType): Promise<Post> {
    await this.ready();
    const post = await this.getPost(postId, userId);
    if (!post) throw new ApiError(404, "Post not found.");

    const existing = await d1Query<{ reaction_type: string }>(
      "SELECT reaction_type FROM post_reactions WHERE post_id = ? AND user_id = ? LIMIT 1",
      [postId, userId],
    );
    const previous = existing[0]?.reaction_type as ReactionType | undefined;

    const columnFor = (t: ReactionType) =>
      t === "like"
        ? "likes_count"
        : t === "dislike"
          ? "dislikes_count"
          : t === "upgrade"
            ? "upgrades_count"
            : "downgrades_count";

    const statements: { sql: string; params?: unknown[] }[] = [];

    if (previous) {
      statements.push({
        sql: `UPDATE posts SET ${columnFor(previous)} = MAX(0, ${columnFor(previous)} - 1) WHERE id = ?`,
        params: [postId],
      });
      statements.push({ sql: "DELETE FROM post_reactions WHERE post_id = ? AND user_id = ?", params: [postId, userId] });
    }

    if (!previous || previous !== type) {
      statements.push({
        sql: "INSERT INTO post_reactions (id, post_id, user_id, reaction_type, created_at) VALUES (?, ?, ?, ?, ?)",
        params: [`pr_${postId}_${userId}`, postId, userId, type, new Date().toISOString()],
      });
      statements.push({
        sql: `UPDATE posts SET ${columnFor(type)} = ${columnFor(type)} + 1 WHERE id = ?`,
        params: [postId],
      });
    }

    if (statements.length > 0) await d1Batch(statements);
    const updated = await this.getPost(postId, userId);
    if (!updated) throw new ApiError(404, "Post not found.");
    return updated;
  }

  async votePoll(postId: string, userId: string, optionId: string): Promise<Post> {
    await this.ready();
    const rows = await d1Query<{ poll_data: string | null }>("SELECT poll_data FROM posts WHERE id = ? LIMIT 1", [
      postId,
    ]);
    if (rows.length === 0) throw new ApiError(404, "Post not found.");
    const data = parseJson<PollData | null>(rows[0].poll_data, null);
    if (!data) throw new ApiError(404, "This post has no poll.");

    const previous = data.votes?.[userId];
    if (previous === optionId) {
      const post = await this.getPost(postId, userId);
      if (!post) throw new ApiError(404, "Post not found.");
      return post;
    }
    if (previous) {
      const prevOption = data.options.find((o) => o.id === previous);
      if (prevOption) prevOption.votes = Math.max(0, Number(prevOption.votes) - 1);
    }
    const option = data.options.find((o) => o.id === optionId);
    if (!option) throw new ApiError(400, "Unknown poll option.");
    option.votes = (Number(option.votes) || 0) + 1;
    data.votes = { ...(data.votes ?? {}), [userId]: optionId };

    await d1Query("UPDATE posts SET poll_data = ? WHERE id = ?", [JSON.stringify(data), postId]);
    const post = await this.getPost(postId, userId);
    if (!post) throw new ApiError(404, "Post not found.");
    return post;
  }

  // ------------------------------------------------------------- comments
  async listComments(postId: string): Promise<Comment[]> {
    await this.ready();
    const rows = await d1Query<CommentRow>(
      "SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC",
      [postId],
    );
    const users = await this.usersByIds([...new Set(rows.map((r) => r.user_id))]);

    const toComment = (row: CommentRow): Comment => {
      const author = users.get(row.user_id);
      return {
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        author: author ? toPublicUser(author) : null,
        parentCommentId: row.parent_comment_id,
        content: row.content,
        createdAt: row.created_at,
        replies: [],
      };
    };

    const byId = new Map<string, Comment>();
    for (const row of rows) byId.set(row.id, toComment(row));

    const roots: Comment[] = [];
    for (const row of rows) {
      const comment = byId.get(row.id);
      if (!comment) continue;
      if (row.parent_comment_id && byId.has(row.parent_comment_id)) {
        byId.get(row.parent_comment_id)?.replies.push(comment);
      } else {
        roots.push(comment);
      }
    }
    return roots;
  }

  async createComment(input: CreateCommentInput): Promise<Comment> {
    await this.ready();
    await d1Query(
      "INSERT INTO comments (id, post_id, user_id, parent_comment_id, content, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [input.id, input.postId, input.userId, input.parentCommentId, input.content, input.createdAt],
    );
    const author = await this.getUserById(input.userId);
    return {
      id: input.id,
      postId: input.postId,
      userId: input.userId,
      author: author ? toPublicUser(author) : null,
      parentCommentId: input.parentCommentId,
      content: input.content,
      createdAt: input.createdAt,
      replies: [],
    };
  }

  // ----------------------------------------------------------- friendships
  async listFriends(userId: string): Promise<FriendGraph> {
    await this.ready();
    const rows = await d1Query<FriendshipRow>(
      "SELECT * FROM friendships WHERE requester_id = ? OR receiver_id = ?",
      [userId, userId],
    );
    const relatedIds = new Set<string>([userId]);
    for (const row of rows) {
      relatedIds.add(row.requester_id === userId ? row.receiver_id : row.requester_id);
    }
    const users = await this.usersByIds([...relatedIds]);
    const allUsers = await this.listUsers(userId);

    const friends: PublicUser[] = [];
    const incoming: FriendGraph["incoming"] = [];
    const outgoing: FriendGraph["outgoing"] = [];

    for (const row of rows) {
      const otherId = row.requester_id === userId ? row.receiver_id : row.requester_id;
      const other = users.get(otherId);
      if (!other) continue;
      const pub = toPublicUser(other);
      if (row.status === "accepted") friends.push(pub);
      else if (row.receiver_id === userId) incoming.push({ id: row.id, user: pub, createdAt: row.created_at });
      else outgoing.push({ id: row.id, user: pub, createdAt: row.created_at });
    }

    const suggested = allUsers
      .filter((u) => !relatedIds.has(u.id))
      .map(toPublicUser);

    return { friends, incoming, outgoing, suggested };
  }

  async sendFriendRequest(requesterId: string, receiverId: string): Promise<Friendship> {
    await this.ready();
    if (requesterId === receiverId) throw new ApiError(400, "You cannot Cliq Up yourself.");

    const existing = await d1Query<FriendshipRow>(
      `SELECT * FROM friendships
       WHERE (requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)
       LIMIT 1`,
      [requesterId, receiverId, receiverId, requesterId],
    );

    if (existing[0]) {
      const row = existing[0];
      if (row.status === "pending" && row.receiver_id === requesterId) {
        await d1Query("UPDATE friendships SET status = 'accepted' WHERE id = ?", [row.id]);
        return {
          id: row.id,
          requesterId: row.requester_id,
          receiverId: row.receiver_id,
          status: "accepted",
          createdAt: row.created_at,
        };
      }
      return {
        id: row.id,
        requesterId: row.requester_id,
        receiverId: row.receiver_id,
        status: row.status as Friendship["status"],
        createdAt: row.created_at,
      };
    }

    const id = `fr_${requesterId}_${receiverId}`;
    const createdAt = new Date().toISOString();
    await d1Query(
      "INSERT INTO friendships (id, requester_id, receiver_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
      [id, requesterId, receiverId, createdAt],
    );
    return { id, requesterId, receiverId, status: "pending", createdAt };
  }

  async respondFriendRequest(friendshipId: string, userId: string, accept: boolean): Promise<Friendship> {
    await this.ready();
    const rows = await d1Query<FriendshipRow>("SELECT * FROM friendships WHERE id = ? LIMIT 1", [friendshipId]);
    if (rows.length === 0) throw new ApiError(404, "Friend request not found.");
    const row = rows[0];
    if (row.receiver_id !== userId) throw new ApiError(403, "This request is not yours to answer.");

    if (accept) {
      await d1Query("UPDATE friendships SET status = 'accepted' WHERE id = ?", [friendshipId]);
      return {
        id: row.id,
        requesterId: row.requester_id,
        receiverId: row.receiver_id,
        status: "accepted",
        createdAt: row.created_at,
      };
    }
    await d1Query("DELETE FROM friendships WHERE id = ?", [friendshipId]);
    return {
      id: row.id,
      requesterId: row.requester_id,
      receiverId: row.receiver_id,
      status: "pending",
      createdAt: row.created_at,
    };
  }

  // -------------------------------------------------------------- messages
  private decorateMessage(row: MessageRow, viewerId: string, parents: Map<string, MessageRow>): Message {
    const raw = parseJson<{ userId: string; emoji: string }[]>(row.reactions, []);
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
      isRead: Number(row.is_read) === 1,
      createdAt: row.created_at,
      fromMe: row.sender_id === viewerId,
    };
  }

  async listConversations(userId: string): Promise<ConversationSummary[]> {
    await this.ready();
    const rows = await d1Query<MessageRow>(
      `SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ? ORDER BY created_at ASC`,
      [userId, userId],
    );

    const partners = new Set<string>();
    for (const row of rows) partners.add(row.sender_id === userId ? row.receiver_id : row.sender_id);

    const friendRows = await d1Query<FriendshipRow>(
      "SELECT * FROM friendships WHERE (requester_id = ? OR receiver_id = ?) AND status = 'accepted'",
      [userId, userId],
    );
    for (const row of friendRows) partners.add(row.requester_id === userId ? row.receiver_id : row.requester_id);

    if (partners.size === 0) return [];
    const users = await this.usersByIds([...partners]);
    const parentMap = new Map(rows.map((r) => [r.id, r]));

    const summaries: ConversationSummary[] = [];
    for (const partnerId of partners) {
      const partner = users.get(partnerId);
      if (!partner) continue;
      const thread = rows.filter(
        (r) =>
          (r.sender_id === userId && r.receiver_id === partnerId) ||
          (r.sender_id === partnerId && r.receiver_id === userId),
      );
      const last = thread[thread.length - 1] ?? null;
      summaries.push({
        partner: toPublicUser(partner),
        lastMessage: last ? this.decorateMessage(last, userId, parentMap) : null,
        unreadCount: thread.filter((r) => r.receiver_id === userId && Number(r.is_read) === 0).length,
        streak: computeStreak(
          thread.map((r) => ({ senderId: r.sender_id, receiverId: r.receiver_id, createdAt: r.created_at })),
          userId,
          partnerId,
        ).days,
      });
    }

    return summaries.sort((a, b) =>
      (b.lastMessage?.createdAt ?? "").localeCompare(a.lastMessage?.createdAt ?? ""),
    );
  }

  async listMessages(userId: string, partnerId: string): Promise<Message[]> {
    await this.ready();
    const rows = await d1Query<MessageRow>(
      `SELECT * FROM messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       ORDER BY created_at ASC`,
      [userId, partnerId, partnerId, userId],
    );
    const parentMap = new Map(rows.map((r) => [r.id, r]));
    return rows.map((r) => this.decorateMessage(r, userId, parentMap));
  }

  async createMessage(input: CreateMessageInput): Promise<Message> {
    await this.ready();
    await d1Query(
      `INSERT INTO messages (id, sender_id, receiver_id, content, media_url, reply_to_id, reactions, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, '[]', 0, ?)`,
      [input.id, input.senderId, input.receiverId, input.content, input.mediaUrl, input.replyToId, input.createdAt],
    );
    let replyTo: Message["replyTo"] = null;
    if (input.replyToId) {
      const parent = await d1Query<MessageRow>("SELECT * FROM messages WHERE id = ? LIMIT 1", [input.replyToId]);
      if (parent[0]) {
        replyTo = { id: parent[0].id, content: parent[0].content ?? "", senderId: parent[0].sender_id };
      }
    }
    return {
      id: input.id,
      senderId: input.senderId,
      receiverId: input.receiverId,
      content: input.content,
      mediaUrl: input.mediaUrl,
      replyToId: input.replyToId,
      replyTo,
      reactions: [],
      isRead: false,
      createdAt: input.createdAt,
      fromMe: true,
    };
  }

  async deleteMessage(id: string, userId: string): Promise<boolean> {
    await this.ready();
    const rows = await d1Query<{ sender_id: string }>("SELECT sender_id FROM messages WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) return false;
    if (rows[0].sender_id !== userId) throw new ApiError(403, "You can only unsend your own messages.");
    await d1Query("DELETE FROM messages WHERE id = ?", [id]);
    return true;
  }

  async setMessageReaction(messageId: string, userId: string, emoji: string): Promise<Message> {
    await this.ready();
    const rows = await d1Query<MessageRow>("SELECT * FROM messages WHERE id = ? LIMIT 1", [messageId]);
    if (rows.length === 0) throw new ApiError(404, "Message not found.");
    const row = rows[0];
    const raw = parseJson<{ userId: string; emoji: string }[]>(row.reactions, []);
    const index = raw.findIndex((r) => r.userId === userId);
    if (index >= 0) {
      if (raw[index].emoji === emoji) raw.splice(index, 1);
      else raw[index].emoji = emoji;
    } else {
      raw.push({ userId, emoji });
    }
    await d1Query("UPDATE messages SET reactions = ? WHERE id = ?", [JSON.stringify(raw), messageId]);
    const updated: MessageRow = { ...row, reactions: JSON.stringify(raw) };
    const parentMap = new Map<string, MessageRow>();
    if (row.reply_to_id) {
      const parent = await d1Query<MessageRow>("SELECT * FROM messages WHERE id = ? LIMIT 1", [row.reply_to_id]);
      if (parent[0]) parentMap.set(parent[0].id, parent[0]);
    }
    return this.decorateMessage(updated, userId, parentMap);
  }

  async markConversationRead(userId: string, partnerId: string): Promise<void> {
    await this.ready();
    await d1Query("UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ?", [userId, partnerId]);
  }

  async getStreak(userId: string, partnerId: string): Promise<StreakInfo> {
    await this.ready();
    const rows = await d1Query<{ sender_id: string; receiver_id: string; created_at: string }>(
      `SELECT sender_id, receiver_id, created_at FROM messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
      [userId, partnerId, partnerId, userId],
    );
    return computeStreak(
      rows.map((r) => ({ senderId: r.sender_id, receiverId: r.receiver_id, createdAt: r.created_at })),
      userId,
      partnerId,
    );
  }

  // ---------------------------------------------------------------- stories
  async listStories(viewerId: string): Promise<StoryGroup[]> {
    await this.ready();
    const cutoff = new Date(Date.now() - STORY_TTL_MS).toISOString();
    const rows = await d1Query<StoryRow>(
      `SELECT s.*, EXISTS(SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.user_id = ?) AS viewed
       FROM stories s WHERE s.created_at >= ? ORDER BY s.created_at ASC`,
      [viewerId, cutoff],
    );
    const authors = await this.usersByIds([...new Set(rows.map((r) => r.user_id))]);

    const byAuthor = new Map<string, { author: PublicUser; stories: Story[] }>();
    for (const row of rows) {
      const author = authors.get(row.user_id);
      if (!author) continue;
      const pub = toPublicUser(author);
      const story: Story = {
        id: row.id,
        userId: row.user_id,
        author: pub,
        mediaUrl: row.media_url,
        caption: row.caption ?? "",
        bgStyle: (row.bg_style as StoryBgStyle) ?? "indigo",
        viewsCount: Number(row.views_count) || 0,
        viewed: Number(row.viewed) === 1,
        createdAt: row.created_at,
      };
      const entry = byAuthor.get(row.user_id) ?? { author: pub, stories: [] };
      entry.stories.push(story);
      byAuthor.set(row.user_id, entry);
    }

    const groups: StoryGroup[] = [...byAuthor.values()].map(({ author, stories }) => ({
      author,
      stories,
      viewed: stories.every((s) => s.viewed),
    }));
    return groups.sort((a, b) => {
      if (a.viewed !== b.viewed) return a.viewed ? 1 : -1;
      const aLast = a.stories[a.stories.length - 1]?.createdAt ?? "";
      const bLast = b.stories[b.stories.length - 1]?.createdAt ?? "";
      return bLast.localeCompare(aLast);
    });
  }

  async createStory(input: CreateStoryInput): Promise<Story> {
    await this.ready();
    await d1Query(
      `INSERT INTO stories (id, user_id, media_url, caption, bg_style, views_count, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [input.id, input.userId, input.mediaUrl, input.caption, input.bgStyle, input.createdAt],
    );
    const author = await this.getUserById(input.userId);
    return {
      id: input.id,
      userId: input.userId,
      author: author ? toPublicUser(author) : null,
      mediaUrl: input.mediaUrl,
      caption: input.caption,
      bgStyle: input.bgStyle,
      viewsCount: 0,
      viewed: false,
      createdAt: input.createdAt,
    };
  }

  async viewStory(storyId: string, viewerId: string): Promise<void> {
    await this.ready();
    const existing = await d1Query<{ story_id: string }>(
      "SELECT story_id FROM story_views WHERE story_id = ? AND user_id = ? LIMIT 1",
      [storyId, viewerId],
    );
    if (existing.length > 0) return;
    await d1Batch([
      {
        sql: "INSERT INTO story_views (story_id, user_id, created_at) VALUES (?, ?, ?)",
        params: [storyId, viewerId, new Date().toISOString()],
      },
      { sql: "UPDATE stories SET views_count = views_count + 1 WHERE id = ?", params: [storyId] },
    ]);
  }

  async deleteStory(id: string, userId: string): Promise<boolean> {
    await this.ready();
    const rows = await d1Query<{ user_id: string }>("SELECT user_id FROM stories WHERE id = ? LIMIT 1", [id]);
    if (rows.length === 0) return false;
    if (rows[0].user_id !== userId) throw new ApiError(403, "You can only delete your own story.");
    await d1Batch([
      { sql: "DELETE FROM stories WHERE id = ?", params: [id] },
      { sql: "DELETE FROM story_views WHERE story_id = ?", params: [id] },
    ]);
    return true;
  }

  // ----------------------------------------------------------------- groups
  private async ensureLounges(): Promise<void> {
    await this.ready();
    await d1Batch(
      DEFAULT_LOUNGES.map((lounge, index) => ({
        sql: `INSERT OR IGNORE INTO groups (id, name, description, icon, creator_id, is_public, created_at)
              VALUES (?, ?, ?, ?, NULL, 1, ?)`,
        params: [lounge.id, lounge.name, lounge.description, lounge.icon, groupSeededAt(index)],
      })),
    );
  }

  async listGroups(viewerId: string): Promise<Group[]> {
    await this.ensureLounges();
    const rows = await d1Query<GroupRow>(
      `SELECT g.*,
              (SELECT COUNT(*) FROM group_members m WHERE m.group_id = g.id) AS member_count,
              EXISTS(SELECT 1 FROM group_members m WHERE m.group_id = g.id AND m.user_id = ?) AS joined,
              (SELECT MAX(created_at) FROM group_messages gm WHERE gm.group_id = g.id) AS last_message_at
       FROM groups g
       ORDER BY g.is_public DESC,
                COALESCE((SELECT MAX(created_at) FROM group_messages gm WHERE gm.group_id = g.id), g.created_at) DESC`,
      [viewerId],
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      icon: row.icon ?? "💬",
      creatorId: row.creator_id ?? "system",
      isPublic: Number(row.is_public) === 1,
      memberCount: Number(row.member_count) || 0,
      joined: Number(row.is_public) === 1 || Number(row.joined) === 1,
      lastMessageAt: row.last_message_at ?? null,
      createdAt: row.created_at,
    }));
  }

  async createGroup(input: CreateGroupInput): Promise<Group> {
    await this.ready();
    const existing = await d1Query<{ id: string }>("SELECT id FROM groups WHERE id = ? LIMIT 1", [input.id]);
    if (existing.length > 0) throw new ApiError(409, "That group already exists.");
    const members = [...new Set([input.creatorId, ...(input.memberIds ?? [])])];
    await d1Batch([
      {
        sql: `INSERT INTO groups (id, name, description, icon, creator_id, is_public, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [input.id, input.name, input.description, input.icon, input.creatorId, input.isPublic ? 1 : 0, input.createdAt],
      },
      ...members.map((userId) => ({
        sql: "INSERT OR IGNORE INTO group_members (group_id, user_id, created_at) VALUES (?, ?, ?)",
        params: [input.id, userId, input.createdAt],
      })),
    ]);
    return {
      id: input.id,
      name: input.name,
      description: input.description,
      icon: input.icon,
      creatorId: input.creatorId,
      isPublic: input.isPublic,
      memberCount: members.length,
      joined: true,
      lastMessageAt: null,
      createdAt: input.createdAt,
    };
  }

  async joinGroup(groupId: string, userId: string): Promise<Group> {
    await this.ensureLounges();
    const rows = await d1Query<GroupRow>("SELECT * FROM groups WHERE id = ? LIMIT 1", [groupId]);
    if (rows.length === 0) throw new ApiError(404, "That group does not exist.");
    await d1Query("INSERT OR IGNORE INTO group_members (group_id, user_id, created_at) VALUES (?, ?, ?)", [
      groupId,
      userId,
      new Date().toISOString(),
    ]);
    const count = await d1Query<{ count: number }>(
      "SELECT COUNT(*) AS count FROM group_members WHERE group_id = ?",
      [groupId],
    );
    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      icon: row.icon ?? "💬",
      creatorId: row.creator_id ?? "system",
      isPublic: Number(row.is_public) === 1,
      memberCount: Number(count[0]?.count ?? 0),
      joined: true,
      lastMessageAt: null,
      createdAt: row.created_at,
    };
  }

  private decorateGroupMessage(row: GroupMessageRow, sender: PublicUser | null, viewerId: string): GroupMessage {
    const raw = parseJson<{ userId: string; emoji: string }[]>(row.reactions, []);
    const counts = new Map<string, number>();
    for (const r of raw) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
    const reactions: MessageReaction[] = [...counts.entries()].map(([emoji, count]) => ({
      emoji,
      count,
      mine: raw.some((r) => r.emoji === emoji && r.userId === viewerId),
    }));
    return {
      id: row.id,
      groupId: row.group_id,
      senderId: row.sender_id,
      sender,
      content: row.content ?? "",
      mediaUrl: row.media_url,
      reactions,
      createdAt: row.created_at,
    };
  }

  async listGroupMessages(groupId: string, viewerId: string): Promise<GroupMessage[]> {
    await this.ensureLounges();
    const group = await d1Query<{ id: string }>("SELECT id FROM groups WHERE id = ? LIMIT 1", [groupId]);
    if (group.length === 0) throw new ApiError(404, "That group does not exist.");
    const rows = await d1Query<GroupMessageRow>(
      "SELECT * FROM group_messages WHERE group_id = ? ORDER BY created_at ASC",
      [groupId],
    );
    const senders = await this.usersByIds([...new Set(rows.map((r) => r.sender_id))]);
    return rows.map((row) => {
      const sender = senders.get(row.sender_id);
      return this.decorateGroupMessage(row, sender ? toPublicUser(sender) : null, viewerId);
    });
  }

  async createGroupMessage(input: CreateGroupMessageInput): Promise<GroupMessage> {
    await this.ensureLounges();
    const group = await d1Query<{ id: string; is_public: number }>(
      "SELECT id, is_public FROM groups WHERE id = ? LIMIT 1",
      [input.groupId],
    );
    if (group.length === 0) throw new ApiError(404, "That group does not exist.");
    const statements: { sql: string; params?: unknown[] }[] = [];
    if (Number(group[0].is_public) === 1) {
      statements.push({
        sql: "INSERT OR IGNORE INTO group_members (group_id, user_id, created_at) VALUES (?, ?, ?)",
        params: [input.groupId, input.senderId, input.createdAt],
      });
    }
    statements.push({
      sql: `INSERT INTO group_messages (id, group_id, sender_id, content, media_url, reactions, created_at)
            VALUES (?, ?, ?, ?, ?, '[]', ?)`,
      params: [input.id, input.groupId, input.senderId, input.content, input.mediaUrl, input.createdAt],
    });
    await d1Batch(statements);
    const sender = await this.getUserById(input.senderId);
    return {
      id: input.id,
      groupId: input.groupId,
      senderId: input.senderId,
      sender: sender ? toPublicUser(sender) : null,
      content: input.content,
      mediaUrl: input.mediaUrl,
      reactions: [],
      createdAt: input.createdAt,
    };
  }

  async setGroupMessageReaction(messageId: string, userId: string, emoji: string): Promise<GroupMessage> {
    await this.ready();
    const rows = await d1Query<GroupMessageRow>("SELECT * FROM group_messages WHERE id = ? LIMIT 1", [messageId]);
    if (rows.length === 0) throw new ApiError(404, "Message not found.");
    const row = rows[0];
    const raw = parseJson<{ userId: string; emoji: string }[]>(row.reactions, []);
    const index = raw.findIndex((r) => r.userId === userId);
    if (index >= 0) {
      if (raw[index].emoji === emoji) raw.splice(index, 1);
      else raw[index].emoji = emoji;
    } else {
      raw.push({ userId, emoji });
    }
    await d1Query("UPDATE group_messages SET reactions = ? WHERE id = ?", [JSON.stringify(raw), messageId]);
    const sender = await this.getUserById(row.sender_id);
    return this.decorateGroupMessage(
      { ...row, reactions: JSON.stringify(raw) },
      sender ? toPublicUser(sender) : null,
      userId,
    );
  }

  // ------------------------------------------------------------ profile stats

  async getStats(userId: string): Promise<ProfileStats> {
    await this.ready();
    const rows = await d1Query<{ friends: number; following: number; posts: number }>(
      `SELECT
         (SELECT COUNT(*) FROM friendships
           WHERE status = 'accepted' AND (requester_id = ? OR receiver_id = ?)) AS friends,
         (SELECT COUNT(*) FROM friendships WHERE requester_id = ?) AS following,
         (SELECT COUNT(*) FROM posts WHERE user_id = ?) AS posts`,
      [userId, userId, userId, userId],
    );
    const row = rows[0];
    return {
      friends: Number(row?.friends ?? 0),
      following: Number(row?.following ?? 0),
      posts: Number(row?.posts ?? 0),
    };
  }

  async getBadges(userId: string): Promise<UserBadges> {
    await this.ready();
    const totals = await d1Query<{ likes: number; upgrades: number; dislikes: number; downgrades: number }>(
      `SELECT
         COALESCE(SUM(likes_count),0) AS likes,
         COALESCE(SUM(upgrades_count),0) AS upgrades,
         COALESCE(SUM(dislikes_count),0) AS dislikes,
         COALESCE(SUM(downgrades_count),0) AS downgrades
       FROM posts WHERE user_id = ?`,
      [userId],
    );
    const likes = Number(totals[0]?.likes ?? 0);
    const upgrades = Number(totals[0]?.upgrades ?? 0);
    const dislikes = Number(totals[0]?.dislikes ?? 0);
    const downgrades = Number(totals[0]?.downgrades ?? 0);
    const creatorCount = likes + upgrades;
    const cliqScore = likes + upgrades - dislikes - downgrades;

    const rank = await d1Query<{ rank: number }>(
      `SELECT COUNT(*) AS rank FROM users WHERE created_at < (SELECT created_at FROM users WHERE id = ?)`,
      [userId],
    );
    const founding = Number(rank[0]?.rank ?? 999) < 10;

    const partners = await d1Query<{ partner_id: string }>(
      `SELECT DISTINCT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS partner_id
       FROM messages WHERE sender_id = ? OR receiver_id = ?`,
      [userId, userId, userId],
    );
    let maxStreak = 0;
    for (const p of partners) {
      const streak = await this.getStreak(userId, p.partner_id);
      maxStreak = Math.max(maxStreak, streak.days);
    }
    return { badges: buildBadges({ founding, hasStreak: maxStreak > 0, creatorCount, cliqScore }), streak: maxStreak };
  }

  // ---------------------------------------------------------- notifications

  async listNotifications(userId: string): Promise<NotificationItem[]> {
    await this.ready();
    const rows = await d1Query<{
      id: string;
      user_id: string;
      actor_id: string | null;
      kind: string;
      post_id: string | null;
      text: string;
      is_read: number;
      created_at: string;
      post_type: string | null;
      post_media_url: string | null;
      post_content: string | null;
    }>(
      `SELECT n.*, p.type AS post_type, p.media_url AS post_media_url, p.content AS post_content
       FROM notifications n
       LEFT JOIN posts p ON p.id = n.post_id
       WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 60`,
      [userId],
    );
    const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((v): v is string => Boolean(v)))];
    const actors = await this.usersByIds(actorIds);

    return rows.map((r) => {
      const actor = r.actor_id ? actors.get(r.actor_id) : undefined;
      return {
        id: r.id,
        userId: r.user_id,
        actor: actor ? toPublicUser(actor) : null,
        kind: r.kind,
        postId: r.post_id,
        post:
          r.post_id && r.post_type
            ? {
                id: r.post_id,
                type: r.post_type as PostType,
                mediaUrl: r.post_media_url,
                content: r.post_content ?? "",
              }
            : null,
        text: r.text,
        isRead: Number(r.is_read) === 1,
        createdAt: r.created_at,
      };
    });
  }

  async createNotification(input: CreateNotificationInput): Promise<NotificationItem> {
    await this.ready();
    await d1Query(
      `INSERT INTO notifications (id, user_id, actor_id, kind, post_id, text, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [input.id, input.userId, input.actorId, input.kind, input.postId, input.text, input.createdAt],
    );
    const actor = input.actorId ? await this.getUserById(input.actorId) : null;
    let post: NotificationItem["post"] = null;
    if (input.postId) {
      const postRow = await d1Query<{ type: string; media_url: string | null; content: string | null }>(
        "SELECT type, media_url, content FROM posts WHERE id = ?",
        [input.postId],
      );
      if (postRow[0]) {
        post = {
          id: input.postId,
          type: postRow[0].type as PostType,
          mediaUrl: postRow[0].media_url,
          content: postRow[0].content ?? "",
        };
      }
    }
    return {
      id: input.id,
      userId: input.userId,
      actor: actor ? toPublicUser(actor) : null,
      kind: input.kind,
      postId: input.postId,
      post,
      text: input.text,
      isRead: false,
      createdAt: input.createdAt,
    };
  }

  async markNotificationsRead(userId: string): Promise<void> {
    await this.ready();
    await d1Query("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0", [userId]);
  }

  async markNotificationRead(id: string, userId: string): Promise<void> {
    await this.ready();
    await d1Query("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [id, userId]);
  }

  async unreadCounts(userId: string): Promise<UnreadCounts> {
    await this.ready();
    const row = await d1Query<{ notifications: number; messages: number; pending: number }>(
      `SELECT
         (SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0) AS notifications,
         (SELECT COUNT(*) FROM messages WHERE receiver_id = ? AND is_read = 0) AS messages,
         (SELECT COUNT(*) FROM friendships WHERE receiver_id = ? AND status = 'pending') AS pending`,
      [userId, userId, userId],
    );
    return {
      notifications: Number(row[0]?.notifications ?? 0),
      messages: Number(row[0]?.messages ?? 0),
      pendingRequests: Number(row[0]?.pending ?? 0),
    };
  }
}
