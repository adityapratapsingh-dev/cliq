import type {
  Comment,
  ConversationSummary,
  FriendGraph,
  Message,
  Post,
  PostType,
  PublicUser,
  NotificationsResponse,
  ProfileStats,
  ReactionType,
  SessionUser,
  Settings,
  UnreadCounts,
} from "@/types/cliq";

export class ApiClientError extends Error {
  status: number;
  detail?: string;
  constructor(status: number, message: string, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
    this.name = "ApiClientError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = payload as { error?: string; detail?: string } | null;
    const message = body?.error ?? `Request failed (${response.status}).`;
    // Keep the underlying cause (e.g. a D1 error) alongside the user-facing text
    // so failures are diagnosable instead of just "Database unavailable."
    const detail = body?.detail && body.detail !== message ? body.detail : undefined;
    throw new ApiClientError(response.status, message, detail);
  }
  return (payload ?? {}) as T;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: "POST", body: JSON.stringify(body) });
}

/** The API does not know who "me" is for a message; derive `fromMe` from the session. */
let currentUserId: string | undefined;

function decorateMessages(messages: Message[], myId: string | undefined = currentUserId): Message[] {
  if (!myId) return messages.map((m) => ({ ...m, fromMe: false }));
  return messages.map((m) => ({ ...m, fromMe: m.senderId === myId }));
}

function decorateConversations(list: ConversationSummary[]): ConversationSummary[] {
  return list.map((c) => ({
    ...c,
    lastMessage: c.lastMessage ? decorateMessages([c.lastMessage])[0] : null,
  }));
}

/**
 * SWR fetcher. `key` is a path like "/api/posts?type=video", or an array whose
 * first element is the path and second is a query object.
 */
export async function swrFetcher<T>(key: string | [string, Record<string, unknown>?]): Promise<T> {
  let url = typeof key === "string" ? key : key[0];
  const params = typeof key === "string" ? undefined : key[1];
  if (params) {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
    }
    const qs = search.toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }
  return request<T>(url);
}

export const api = {
  // ---------------------------------------------------------------- auth
  async me(): Promise<SessionUser | null> {
    const { user } = await request<{ user: SessionUser | null }>("/api/auth");
    currentUserId = user?.id;
    return user;
  },

  async signUp(input: {
    username: string;
    displayName: string;
    password: string;
    email?: string;
    age?: number | null;
    bio?: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    interests: string[];
  }): Promise<{ user: SessionUser }> {
    const result = await post<{ user: SessionUser }>("/api/auth", { mode: "signup", ...input });
    currentUserId = result.user.id;
    return result;
  },

  async logIn(username: string, password: string): Promise<{ user: SessionUser }> {
    const result = await post<{ user: SessionUser }>("/api/auth", { mode: "login", username, password });
    currentUserId = result.user.id;
    return result;
  },

  async logOut(): Promise<{ ok: boolean }> {
    const result = await request<{ ok: boolean }>("/api/auth", { method: "DELETE" });
    currentUserId = undefined;
    return result;
  },

  // --------------------------------------------------------------- users
  async listUsers(query?: string, interest?: string): Promise<PublicUser[]> {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (interest && interest !== "All Vibes") params.set("interest", interest);
    const suffix = params.toString();
    const { users } = await request<{ users: PublicUser[] }>(`/api/users${suffix ? `?${suffix}` : ""}`);
    return users;
  },

  listNotifications(): Promise<NotificationsResponse> {
    return request<NotificationsResponse>("/api/notifications");
  },

  /** Omit `id` to mark everything read. */
  markNotificationsRead(id?: string): Promise<{ ok: boolean; counts: UnreadCounts }> {
    return request<{ ok: boolean; counts: UnreadCounts }>("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify(id ? { id } : {}),
    });
  },

  getStats(): Promise<ProfileStats> {
    return request<ProfileStats>("/api/stats");
  },

  async getProfile(userId: string): Promise<PublicUser | null> {
    const { user } = await request<{ user: PublicUser | null }>(`/api/users/${encodeURIComponent(userId)}`);
    return user;
  },

  /** Set the 24-hour Cliq Note shown at the top of Chats / Chat Posts. */
  setNote(text: string, emoji: string): Promise<{ user: SessionUser }> {
    return post<{ user: SessionUser }>("/api/notes", { text, emoji });
  },

  clearNote(): Promise<{ user: SessionUser }> {
    return post<{ user: SessionUser }>("/api/notes", { clear: true });
  },

  updateProfile(patch: {
    displayName?: string;
    bio?: string;
    age?: number | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    interests?: string[];
    settings?: Partial<Settings>;
  }): Promise<{ user: SessionUser }> {
    return request<{ user: SessionUser }>("/api/users", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  // --------------------------------------------------------------- posts
  async listPosts(type: PostType): Promise<Post[]> {
    const { posts } = await request<{ posts: Post[] }>(`/api/posts?type=${type}`);
    return posts;
  },

  createPost(input: {
    type: PostType;
    content: string;
    mediaUrl?: string | null;
    flair?: string | null;
    pollOptions?: string[];
  }): Promise<{ post: Post }> {
    return post<{ post: Post }>("/api/posts", input);
  },

  deletePost(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/posts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  react(postId: string, reaction: ReactionType): Promise<{ post: Post }> {
    return post<{ post: Post }>("/api/posts/react", { postId, reaction });
  },

  votePoll(postId: string, optionId: string): Promise<{ post: Post }> {
    return post<{ post: Post }>("/api/posts/react", { postId, optionId });
  },

  // ------------------------------------------------------------ comments
  async listComments(postId: string): Promise<Comment[]> {
    const { comments } = await request<{ comments: Comment[] }>(
      `/api/comments?postId=${encodeURIComponent(postId)}`,
    );
    return comments;
  },

  addComment(postId: string, content: string, parentCommentId?: string | null): Promise<{ comment: Comment }> {
    return post<{ comment: Comment }>("/api/comments", { postId, content, parentCommentId: parentCommentId ?? null });
  },

  // ----------------------------------------------------------- friends
  getFriends(): Promise<FriendGraph> {
    return request<FriendGraph>("/api/friends");
  },

  requestFriend(userId: string): Promise<FriendGraph> {
    return post<FriendGraph>("/api/friends", { action: "request", userId });
  },

  respondFriend(friendshipId: string, accept: boolean): Promise<FriendGraph> {
    return post<FriendGraph>("/api/friends", {
      action: accept ? "accept" : "decline",
      friendshipId,
    });
  },

  // ---------------------------------------------------------- messages
  async listConversations(): Promise<ConversationSummary[]> {
    const { conversations } = await request<{ conversations: ConversationSummary[] }>("/api/messages");
    return decorateConversations(conversations);
  },

  /** Explicitly mark a conversation read (used when opening a thread). */
  markConversationRead(partnerId: string): Promise<{ ok: boolean; counts: UnreadCounts }> {
    return request<{ ok: boolean; counts: UnreadCounts }>("/api/messages", {
      method: "PATCH",
      body: JSON.stringify({ action: "markRead", partnerId }),
    });
  },

  async listMessages(partnerId: string, markRead = true): Promise<Message[]> {
    const params = new URLSearchParams({ with: partnerId });
    if (!markRead) params.set("markRead", "false");
    const { messages } = await request<{ messages: Message[] }>(`/api/messages?${params.toString()}`);
    return decorateMessages(messages);
  },

  async sendMessage(input: {
    receiverId: string;
    content?: string;
    mediaUrl?: string | null;
    replyToId?: string | null;
  }): Promise<{ message: Message }> {
    const { message } = await post<{ message: Message }>("/api/messages", input);
    return { message: decorateMessages([message])[0] };
  },

  async reactToMessage(messageId: string, emoji: string): Promise<{ message: Message }> {
    const { message } = await request<{ message: Message }>("/api/messages", {
      method: "PATCH",
      body: JSON.stringify({ messageId, emoji }),
    });
    return { message: decorateMessages([message])[0] };
  },

  deleteMessage(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/messages?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
