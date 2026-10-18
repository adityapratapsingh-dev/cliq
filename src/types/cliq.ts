export type TabKey = "videos" | "photos" | "chatposts" | "friends" | "profile";

export type AccentKey = "violet" | "cyan" | "rose" | "emerald";

export type MessageScope = "everyone" | "shared" | "friends";

export type PostType = "video" | "photo" | "chat";

export type ReactionType = "like" | "dislike" | "upgrade" | "downgrade";

export type FriendshipStatus = "pending" | "accepted";

/**
 * A "Cliq Note" — Instagram-style 24-hour status.
 *
 * Stored inside the user's `settings` JSONB column so no migration is needed,
 * and the API can return it alongside every user row.
 */
export interface CliqNote {
  text: string;
  emoji: string;
  createdAt: string;
}

export const NOTE_MAX_LENGTH = 60;
/** Notes disappear after this long, like Instagram. */
export const NOTE_TTL_HOURS = 24;

export interface Settings {
  privateProfile: boolean;
  whoCanMessage: MessageScope;
  showOnline: boolean;
  hideDislikes: boolean;
  toxicFilter: boolean;
  autoplay: boolean;
  accent: AccentKey;
  notifCliqUp: boolean;
  notifMessages: boolean;
  notifVotes: boolean;
  notifComments: boolean;
  /** The user's current 24-hour status note, if any. */
  note?: CliqNote | null;
}

export const DEFAULT_SETTINGS: Settings = {
  privateProfile: false,
  whoCanMessage: "shared",
  showOnline: true,
  hideDislikes: false,
  toxicFilter: true,
  autoplay: true,
  accent: "violet",
  notifCliqUp: true,
  notifMessages: true,
  notifVotes: true,
  notifComments: false,
  note: null,
};

/** A user as returned to other users (never includes the password hash). */
export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  age: number | null;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  interests: string[];
  createdAt: string;
  /** Active 24-hour status note, when set and not expired. */
  note?: CliqNote | null;
}

/** The signed-in user's own record (adds private fields). */
export interface SessionUser extends PublicUser {
  email: string;
  settings: Settings;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  options: PollOption[];
  votedOptionId: string | null;
}

/** Lightweight preview of an original post embedded in a quote repost. */
export interface QuotedPost {
  id: string;
  type: PostType;
  content: string;
  mediaUrl: string | null;
  author: { id: string; username: string; displayName: string; avatarUrl: string | null } | null;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  author: PublicUser | null;
  type: PostType;
  content: string;
  mediaUrl: string | null;
  flair: string | null;
  flairColor: string | null;
  poll: Poll | null;
  likesCount: number;
  dislikesCount: number;
  upgradesCount: number;
  downgradesCount: number;
  commentCount: number;
  /** the signed-in user's reaction on this post, if any */
  myReaction: ReactionType | null;
  /** Pinned to the top of the author's profile. */
  pinned: boolean;
  /** When set, this post is a quote repost of another post. */
  quotedPost: QuotedPost | null;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  author: PublicUser | null;
  parentCommentId: string | null;
  content: string;
  createdAt: string;
  replies: Comment[];
}

export interface MessageReaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  mediaUrl: string | null;
  replyToId: string | null;
  replyTo: { id: string; content: string; senderId: string } | null;
  reactions: MessageReaction[];
  isRead: boolean;
  createdAt: string;
  /** true when the signed-in user sent this message (derived client-side) */
  fromMe: boolean;
}

export interface ConversationSummary {
  partner: PublicUser;
  lastMessage: Message | null;
  unreadCount: number;
  /** Consecutive-day message streak with this partner (0 when none). */
  streak: number;
}

export interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  status: FriendshipStatus;
  createdAt: string;
}

export interface FriendGraph {
  friends: PublicUser[];
  incoming: { id: string; user: PublicUser; createdAt: string }[];
  outgoing: { id: string; user: PublicUser; createdAt: string }[];
  suggested: PublicUser[];
}

export type NotificationKind =
  | "like"
  | "dislike"
  | "upgrade"
  | "downgrade"
  | "comment"
  | "reply"
  | "poll_vote"
  | "friend_request"
  | "friend_accept"
  | "cliqup"
  | "message";

/** Post context attached to a notification so the Center can render a thumbnail. */
export interface NotificationPost {
  id: string;
  type: PostType;
  mediaUrl: string | null;
  content: string;
}

export interface CliqNotification {
  id: string;
  userId: string;
  actor: PublicUser | null;
  kind: NotificationKind;
  postId: string | null;
  /** Post context for the right-hand thumbnail / quote box. */
  post: NotificationPost | null;
  text: string;
  isRead: boolean;
  createdAt: string;
}

/**
 * Live counters that drive every red dot in the UI. One request keeps the bell,
 * the Chats tab, and the sub-tabs in sync.
 */
export interface UnreadCounts {
  notifications: number;
  messages: number;
  pendingRequests: number;
}

export interface NotificationsResponse {
  notifications: CliqNotification[];
  counts: UnreadCounts;
  /** Breakdown by kind, for the floating activity pill. */
  breakdown: { like: number; comment: number; upgrade: number; cliqp: number };
}

export interface ProfileStats {
  friends: number;
  following: number;
  posts: number;
}

export interface Toast {
  id: string;
  text: string;
  tone: "default" | "success" | "danger";
}

export type CommentTarget = PostType;

/** Error carrying an HTTP status so route handlers can respond consistently. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

/* ----------------------------------------------------------------- stories */

/** A stylized gradient text card, when a story has no media. */
export type StoryBgStyle =
  | "indigo"
  | "sunset"
  | "mint"
  | "midnight"
  | "candy"
  | "ember";

export interface Story {
  id: string;
  userId: string;
  author: PublicUser | null;
  mediaUrl: string | null;
  caption: string;
  /** Gradient theme key when this is a text card (no media). */
  bgStyle: StoryBgStyle;
  viewsCount: number;
  /** true when the signed-in viewer has already seen this story. */
  viewed: boolean;
  createdAt: string;
}

/** One author's worth of stories, for a single ring in the bar. */
export interface StoryGroup {
  author: PublicUser;
  stories: Story[];
  /** true when every story in the group has been viewed. */
  viewed: boolean;
}

/* ------------------------------------------------------------------ groups */

export interface Group {
  id: string;
  name: string;
  description: string;
  icon: string;
  creatorId: string;
  isPublic: boolean;
  memberCount: number;
  /** true when the signed-in user belongs to this group. */
  joined: boolean;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  sender: PublicUser | null;
  content: string;
  mediaUrl: string | null;
  reactions: MessageReaction[];
  createdAt: string;
}

/* ------------------------------------------------- streaks & achievements */

export interface StreakInfo {
  /** Consecutive days both users have messaged each other. */
  days: number;
  /** true when both users have exchanged a message today. */
  activeToday: boolean;
}

/** Ids of the achievement badges a user has earned. */
export type BadgeId = "founding" | "streak" | "creator" | "legend";

export interface AchievementBadge {
  id: BadgeId;
  label: string;
  emoji: string;
  description: string;
  earned: boolean;
}

export interface UserBadges {
  badges: AchievementBadge[];
  streak: number;
}
