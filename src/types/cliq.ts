export type TabKey = "videos" | "photos" | "chatposts" | "friends" | "profile";

export type AccentKey = "violet" | "cyan" | "rose" | "emerald";

export type MessageScope = "everyone" | "shared" | "friends";

export interface CliqUser {
  id: string;
  name: string;
  handle: string;
  age: number;
  vibe: string;
  bio: string;
  interests: string[];
  online: boolean;
  verified?: boolean;
  /** two hex stops used to build the avatar gradient */
  avatar: [string, string];
}

export interface UserProfile extends CliqUser {
  email: string;
  pronouns: string;
  coverArt: ArtSeed;
  friends: number;
  following: number;
  cliqScore: number;
}

export interface ArtSeed {
  from: string;
  to: string;
  tint: string;
  emoji: string;
  label: string;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
  likes: number;
  liked: boolean;
  replies: Comment[];
}

export interface VideoPost {
  id: string;
  authorId: string;
  src: string;
  art: ArtSeed;
  caption: string;
  hashtags: string[];
  audio: string;
  likes: number;
  liked: boolean;
  shares: number;
  reposted: boolean;
  saved: boolean;
  following: boolean;
  comments: Comment[];
  createdAt: string;
}

export interface PhotoPost {
  id: string;
  authorId: string;
  images: ArtSeed[];
  caption: string;
  hashtags: string[];
  likes: number;
  liked: boolean;
  dislikes: number;
  disliked: boolean;
  saved: boolean;
  following: boolean;
  hidden: boolean;
  comments: Comment[];
  createdAt: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface ChatPost {
  id: string;
  authorId: string;
  text: string;
  flair: string;
  flairColor: string;
  upgrades: number;
  downgrades: number;
  vote: "up" | "down" | null;
  reposts: number;
  reposted: boolean;
  saved: boolean;
  comments: Comment[];
  poll?: {
    options: PollOption[];
    votedId: string | null;
  };
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text?: string;
  media?: ArtSeed;
  createdAt: string;
  reactions: { emoji: string; count: number }[];
  myReaction: string | null;
}

export interface Conversation {
  id: string;
  personId: string;
  messages: ChatMessage[];
  unread: number;
  typing: boolean;
  pinned: boolean;
}

export type NotificationKind = "like" | "upgrade" | "comment" | "cliqup" | "message";

export interface CliqNotification {
  id: string;
  kind: NotificationKind;
  actorId: string;
  text: string;
  createdAt: string;
  read: boolean;
  requestState: "pending" | "accepted" | "declined";
}

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
}

export interface Toast {
  id: string;
  text: string;
  tone: "default" | "success" | "danger";
}

export type CommentTarget = "video" | "photo" | "chatpost";
