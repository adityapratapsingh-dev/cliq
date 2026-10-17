import {
  NOTE_TTL_HOURS,
  type CliqNote,
  type Comment,
  type ConversationSummary,
  type FriendGraph,
  type Friendship,
  type Message,
  type Post,
  type PostType,
  type PublicUser,
  type ReactionType,
  type Settings,
} from "@/types/cliq";

/** A user as stored in the database (includes the password hash). */
export interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  passwordHash: string;
  age: number | null;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  interests: string[];
  settings: Settings;
  createdAt: string;
}

export interface CreateUserInput {
  id: string;
  username: string;
  displayName: string;
  email: string;
  passwordHash: string;
  age: number | null;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  interests: string[];
  settings: Settings;
  createdAt: string;
}

export interface UpdateUserPatch {
  displayName?: string;
  bio?: string;
  age?: number | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  interests?: string[];
  settings?: Settings;
}

export interface CreatePostInput {
  id: string;
  userId: string;
  type: PostType;
  content: string;
  mediaUrl: string | null;
  flair: string | null;
  flairColor: string | null;
  pollOptions: { id: string; text: string }[] | null;
  createdAt: string;
}

export interface CreateCommentInput {
  id: string;
  postId: string;
  userId: string;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
}

export interface CreateMessageInput {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  mediaUrl: string | null;
  replyToId: string | null;
  createdAt: string;
}

export interface CreateNotificationInput {
  id: string;
  userId: string;
  actorId: string | null;
  kind: string;
  postId: string | null;
  text: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  actor: PublicUser | null;
  kind: string;
  postId: string | null;
  /** Post context for the thumbnail / quote box in the Activity Center. */
  post: { id: string; type: PostType; mediaUrl: string | null; content: string } | null;
  text: string;
  isRead: boolean;
  createdAt: string;
}

/** Live counters driving every red dot in the UI. */
export interface UnreadCounts {
  notifications: number;
  messages: number;
  pendingRequests: number;
}

export interface ProfileStats {
  friends: number;
  following: number;
  posts: number;
}

export interface Store {
  readonly kind: "neon" | "d1" | "memory";

  // users
  createUser(input: CreateUserInput): Promise<StoredUser>;
  getUserById(id: string): Promise<StoredUser | null>;
  getUserByUsername(username: string): Promise<StoredUser | null>;
  listUsers(excludeId: string): Promise<StoredUser[]>;
  updateUser(id: string, patch: UpdateUserPatch): Promise<StoredUser>;

  // posts
  listPosts(type: PostType, viewerId: string): Promise<Post[]>;
  getPost(id: string, viewerId: string): Promise<Post | null>;
  createPost(input: CreatePostInput): Promise<Post>;
  deletePost(id: string, userId: string): Promise<boolean>;
  setPostReaction(postId: string, userId: string, type: ReactionType): Promise<Post>;
  votePoll(postId: string, userId: string, optionId: string): Promise<Post>;

  // comments
  listComments(postId: string): Promise<Comment[]>;
  createComment(input: CreateCommentInput): Promise<Comment>;

  // friendships
  listFriends(userId: string): Promise<FriendGraph>;
  sendFriendRequest(requesterId: string, receiverId: string): Promise<Friendship>;
  respondFriendRequest(friendshipId: string, userId: string, accept: boolean): Promise<Friendship>;

  // messages
  listConversations(userId: string): Promise<ConversationSummary[]>;
  listMessages(userId: string, partnerId: string): Promise<Message[]>;
  createMessage(input: CreateMessageInput): Promise<Message>;
  deleteMessage(id: string, userId: string): Promise<boolean>;
  setMessageReaction(messageId: string, userId: string, emoji: string): Promise<Message>;
  markConversationRead(userId: string, partnerId: string): Promise<void>;

  // profile stats (real counters for the profile header)
  getStats(userId: string): Promise<ProfileStats>;

  // notifications
  listNotifications(userId: string): Promise<NotificationItem[]>;
  createNotification(input: CreateNotificationInput): Promise<NotificationItem>;
  markNotificationsRead(userId: string): Promise<void>;
  markNotificationRead(id: string, userId: string): Promise<void>;
  /** One round-trip for all three counters. */
  unreadCounts(userId: string): Promise<UnreadCounts>;
}

export function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    age: user.age,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    interests: user.interests,
    createdAt: user.createdAt,
    note: activeNote(user.settings.note),
  };
}

/**
 * Return the note only while it is still within its 24-hour life.
 *
 * Enforced on read so no cron/cleanup job is needed — an expired note simply
 * stops being returned.
 */
export function activeNote(note: CliqNote | null | undefined): CliqNote | null {
  if (!note || !note.text) return null;
  const created = new Date(note.createdAt).getTime();
  if (Number.isNaN(created)) return null;
  const ageHours = (Date.now() - created) / 3_600_000;
  return ageHours >= 0 && ageHours < NOTE_TTL_HOURS ? note : null;
}
