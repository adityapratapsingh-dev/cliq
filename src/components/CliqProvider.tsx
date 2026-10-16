"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ArtSeed,
  ChatMessage,
  ChatPost,
  CliqNotification,
  CliqUser,
  Comment,
  CommentTarget,
  Conversation,
  NotificationKind,
  PhotoPost,
  Settings,
  TabKey,
  Toast,
  UserProfile,
  VideoPost,
} from "@/types/cliq";
import {
  CONVERSATIONS,
  CURRENT_USER_ID,
  DEFAULT_SETTINGS,
  ME,
  NOTIFICATIONS,
  PHOTO_POSTS,
  SUGGESTED_REPLIES,
  CHAT_POSTS,
  USERS,
  VIDEO_POSTS,
} from "@/data/mockCliqData";
import { censor, clockTime, extractHashtags, makeId, minutesAgo } from "@/lib/utils";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

interface CliqState {
  me: UserProfile;
  users: CliqUser[];
  userMap: Record<string, CliqUser>;
  videos: VideoPost[];
  photos: PhotoPost[];
  chatPosts: ChatPost[];
  conversations: Conversation[];
  notifications: CliqNotification[];
  settings: Settings;
  tab: TabKey;
  activeConversationId: string;
  friendIds: string[];
  sentRequests: string[];
  followingIds: string[];
  searchQuery: string;
  toasts: Toast[];
  createOpen: boolean;
  createMode: "video" | "photo" | "chat";
  profileTab: "videos" | "photos" | "chatposts" | "saved";
}

interface CliqActions {
  setTab: (tab: TabKey) => void;
  setSearch: (q: string) => void;
  setCreateOpen: (open: boolean) => void;
  setCreateMode: (mode: CliqState["createMode"]) => void;
  setProfileTab: (tab: CliqState["profileTab"]) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetData: () => void;

  toggleVideoLike: (id: string) => void;
  toggleVideoSave: (id: string) => void;
  toggleVideoRepost: (id: string) => void;
  toggleFollow: (authorId: string) => void;
  toggleFollowingId: (authorId: string) => void;
  addComment: (target: CommentTarget, postId: string, text: string, parentId?: string) => void;
  toggleCommentLike: (target: CommentTarget, postId: string, commentId: string) => void;

  togglePhotoLike: (id: string) => void;
  togglePhotoDislike: (id: string) => void;
  togglePhotoSave: (id: string) => void;
  hidePhoto: (id: string) => void;

  voteChatPost: (id: string, dir: "up" | "down") => void;
  toggleChatRepost: (id: string) => void;
  toggleChatSave: (id: string) => void;
  votePoll: (postId: string, optionId: string) => void;
  addChatPost: (text: string, flair: string, flairColor: string, pollOptions: string[]) => void;

  addVideoPost: (art: ArtSeed, caption: string, src: string) => void;
  addPhotoPost: (art: ArtSeed, caption: string) => void;

  sendFriendRequest: (userId: string) => void;
  acceptNotification: (id: string) => void;
  declineNotification: (id: string) => void;
  markNotificationsRead: () => void;

  openConversation: (personId: string) => void;
  sendMessage: (text?: string, media?: ArtSeed) => void;
  reactToMessage: (messageId: string, emoji: string) => void;
  clearChat: (conversationId: string) => void;
  blockUser: (personId: string) => void;

  updateProfile: (patch: Partial<Pick<UserProfile, "name" | "handle" | "bio" | "interests" | "pronouns">>) => void;

  toast: (text: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: string) => void;
}

type CliqContextValue = CliqState & CliqActions;

const CliqContext = createContext<CliqContextValue | null>(null);

export function useCliq(): CliqContextValue {
  const ctx = useContext(CliqContext);
  if (!ctx) throw new Error("useCliq must be used inside CliqProvider");
  return ctx;
}

function findComment(comments: Comment[], id: string): Comment | null {
  for (const comment of comments) {
    if (comment.id === id) return comment;
    const nested = findComment(comment.replies, id);
    if (nested) return nested;
  }
  return null;
}

function appendReply(comments: Comment[], parentId: string, reply: Comment): Comment[] {
  return comments.map((comment) => {
    if (comment.id === parentId) {
      return { ...comment, replies: [...comment.replies, reply] };
    }
    return { ...comment, replies: appendReply(comment.replies, parentId, reply) };
  });
}

export function CliqProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<UserProfile>(() => deepClone(ME));
  const [videos, setVideos] = useState<VideoPost[]>(() => deepClone(VIDEO_POSTS));
  const [photos, setPhotos] = useState<PhotoPost[]>(() => deepClone(PHOTO_POSTS));
  const [chatPosts, setChatPosts] = useState<ChatPost[]>(() => deepClone(CHAT_POSTS));
  const [conversations, setConversations] = useState<Conversation[]>(() => deepClone(CONVERSATIONS));
  const [notifications, setNotifications] = useState<CliqNotification[]>(() => deepClone(NOTIFICATIONS));
  const [settings, setSettings] = useState<Settings>(() => deepClone(DEFAULT_SETTINGS));
  const [tab, setTab] = useState<TabKey>("videos");
  const [activeConversationId, setActiveConversationId] = useState<string>("dm_maya");
  const [friendIds, setFriendIds] = useState<string[]>(() =>
    USERS.filter((u) => u.id !== CURRENT_USER_ID && u.online).map((u) => u.id).slice(0, 6),
  );
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>(() =>
    VIDEO_POSTS.filter((v) => v.following).map((v) => v.authorId),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CliqState["createMode"]>("video");
  const [profileTab, setProfileTab] = useState<CliqState["profileTab"]>("videos");
  const [resetKey, setResetKey] = useState(0);

  const replyTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const timers = replyTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const toast = useCallback((text: string, tone: Toast["tone"] = "default") => {
    const id = makeId("toast");
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const setSearch = useCallback((q: string) => setSearchQuery(q), []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetData = useCallback(() => {
    setMe(deepClone(ME));
    setVideos(deepClone(VIDEO_POSTS));
    setPhotos(deepClone(PHOTO_POSTS));
    setChatPosts(deepClone(CHAT_POSTS));
    setConversations(deepClone(CONVERSATIONS));
    setNotifications(deepClone(NOTIFICATIONS));
    setSettings(deepClone(DEFAULT_SETTINGS));
    setFriendIds(USERS.filter((u) => u.id !== CURRENT_USER_ID && u.online).map((u) => u.id).slice(0, 6));
    setSentRequests([]);
    setFollowingIds(VIDEO_POSTS.filter((v) => v.following).map((v) => v.authorId));
    setResetKey((k) => k + 1);
    toast("Demo data restored ✨", "success");
  }, [toast]);

  const toggleFollow = useCallback(
    (authorId: string) => {
      setFollowingIds((prev) => {
        const has = prev.includes(authorId);
        toast(has ? "Removed from your Cliq" : "In Cliq — you're following ⚡", has ? "default" : "success");
        return has ? prev.filter((id) => id !== authorId) : [...prev, authorId];
      });
    },
    [toast],
  );

  const toggleFollowingId = toggleFollow;

  const applyCommentChange = useCallback(
    (target: CommentTarget, postId: string, updater: (comments: Comment[]) => Comment[]) => {
      if (target === "video") {
        setVideos((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: updater(p.comments) } : p)));
      } else if (target === "photo") {
        setPhotos((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: updater(p.comments) } : p)));
      } else {
        setChatPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: updater(p.comments) } : p)));
      }
    },
    [],
  );

  const addComment = useCallback(
    (target: CommentTarget, postId: string, text: string, parentId?: string) => {
      const clean = text.trim();
      if (!clean) return;
      const comment: Comment = {
        id: makeId("cmt"),
        authorId: CURRENT_USER_ID,
        text: censor(clean, settings.toxicFilter),
        createdAt: new Date().toISOString(),
        likes: 0,
        liked: false,
        replies: [],
      };
      applyCommentChange(target, postId, (comments) =>
        parentId ? appendReply(comments, parentId, comment) : [...comments, comment],
      );
      toast("Comment posted 💬", "success");
    },
    [applyCommentChange, settings.toxicFilter, toast],
  );

  const toggleCommentLike = useCallback(
    (target: CommentTarget, postId: string, commentId: string) => {
      applyCommentChange(target, postId, (comments) => {
        const clone = deepClone(comments);
        const found = findComment(clone, commentId);
        if (found) {
          found.liked = !found.liked;
          found.likes += found.liked ? 1 : -1;
        }
        return clone;
      });
    },
    [applyCommentChange],
  );

  const toggleVideoLike = useCallback((id: string) => {
    setVideos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p)),
    );
  }, []);

  const toggleVideoSave = useCallback(
    (id: string) => {
      setVideos((prev) => {
        const target = prev.find((p) => p.id === id);
        if (target) toast(target.saved ? "Removed from Saved" : "Saved to your profile 🔖", target.saved ? "default" : "success");
        return prev.map((p) => (p.id === id ? { ...p, saved: !p.saved } : p));
      });
    },
    [toast],
  );

  const toggleVideoRepost = useCallback(
    (id: string) => {
      setVideos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, reposted: !p.reposted, shares: p.shares + (p.reposted ? -1 : 1) } : p)),
      );
    },
    [],
  );

  const togglePhotoLike = useCallback((id: string) => {
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const nextLiked = !p.liked;
        return {
          ...p,
          liked: nextLiked,
          likes: p.likes + (nextLiked ? 1 : -1),
          disliked: false,
          dislikes: p.disliked ? p.dislikes - 1 : p.dislikes,
        };
      }),
    );
  }, []);

  const togglePhotoDislike = useCallback(
    (id: string) => {
      setPhotos((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const nextDisliked = !p.disliked;
          if (nextDisliked) toast("Downvote sent 👎", "default");
          return {
            ...p,
            disliked: nextDisliked,
            dislikes: p.dislikes + (nextDisliked ? 1 : -1),
            liked: false,
            likes: p.liked ? p.likes - 1 : p.likes,
          };
        }),
      );
    },
    [toast],
  );

  const togglePhotoSave = useCallback(
    (id: string) => {
      setPhotos((prev) => {
        const target = prev.find((p) => p.id === id);
        if (target) toast(target.saved ? "Removed from Saved" : "Saved to your profile 🔖", target.saved ? "default" : "success");
        return prev.map((p) => (p.id === id ? { ...p, saved: !p.saved } : p));
      });
    },
    [toast],
  );

  const hidePhoto = useCallback(
    (id: string) => {
      setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, hidden: true } : p)));
      toast("Post hidden from your feed", "default");
    },
    [toast],
  );

  const voteChatPost = useCallback((id: string, dir: "up" | "down") => {
    setChatPosts((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        let { upgrades, downgrades } = p;
        if (p.vote === "up") upgrades -= 1;
        if (p.vote === "down") downgrades -= 1;
        let vote: ChatPost["vote"];
        if (p.vote === dir) {
          vote = null;
        } else {
          vote = dir;
          if (dir === "up") upgrades += 1;
          else downgrades += 1;
        }
        return { ...p, upgrades, downgrades, vote };
      }),
    );
  }, []);

  const toggleChatRepost = useCallback((id: string) => {
    setChatPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, reposted: !p.reposted, reposts: p.reposts + (p.reposted ? -1 : 1) } : p)),
    );
  }, []);

  const toggleChatSave = useCallback(
    (id: string) => {
      setChatPosts((prev) => {
        const target = prev.find((p) => p.id === id);
        if (target) toast(target.saved ? "Removed from Saved" : "Post saved 🔖", target.saved ? "default" : "success");
        return prev.map((p) => (p.id === id ? { ...p, saved: !p.saved } : p));
      });
    },
    [toast],
  );

  const votePoll = useCallback((postId: string, optionId: string) => {
    setChatPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId || !p.poll) return p;
        if (p.poll.votedId === optionId) return p;
        const options = p.poll.options.map((o) => {
          let votes = o.votes;
          if (o.id === p.poll?.votedId) votes -= 1;
          if (o.id === optionId) votes += 1;
          return { ...o, votes };
        });
        return { ...p, poll: { options, votedId: optionId } };
      }),
    );
  }, []);

  const addChatPost = useCallback(
    (text: string, flair: string, flairColor: string, pollOptions: string[]) => {
      const clean = text.trim();
      if (!clean) return;
      const cleaned = censor(clean, settings.toxicFilter);
      const post: ChatPost = {
        id: makeId("tp"),
        authorId: CURRENT_USER_ID,
        text: cleaned,
        flair: flair || "#AskCliq",
        flairColor: flairColor || "#8b5cf6",
        upgrades: 1,
        downgrades: 0,
        vote: "up",
        reposts: 0,
        reposted: false,
        saved: false,
        comments: [],
        createdAt: new Date().toISOString(),
        poll: pollOptions.length
          ? {
              options: pollOptions.map((label) => ({ id: makeId("opt"), text: label, votes: 0 })),
              votedId: null,
            }
          : undefined,
      };
      void extractHashtags(cleaned);
      setChatPosts((prev) => [post, ...prev]);
      setProfileTab((t) => t);
      setMe((prev) => ({ ...prev, cliqScore: prev.cliqScore + 1 }));
      toast("Thought dropped on Cliq ⚡", "success");
    },
    [settings.toxicFilter, toast],
  );

  const addVideoPost = useCallback(
    (art: ArtSeed, caption: string, src: string) => {
      const clean = censor(caption.trim(), settings.toxicFilter);
      const post: VideoPost = {
        id: makeId("vp"),
        authorId: CURRENT_USER_ID,
        src,
        art,
        caption: clean || "new drop 🎬",
        hashtags: extractHashtags(clean),
        audio: `${me.handle} · original audio`,
        likes: 0,
        liked: false,
        shares: 0,
        reposted: false,
        saved: false,
        following: false,
        comments: [],
        createdAt: new Date().toISOString(),
      };
      setVideos((prev) => [post, ...prev]);
      toast("Video published 🎬", "success");
    },
    [me.handle, settings.toxicFilter, toast],
  );

  const addPhotoPost = useCallback(
    (art: ArtSeed, caption: string) => {
      const clean = censor(caption.trim(), settings.toxicFilter);
      const post: PhotoPost = {
        id: makeId("pp"),
        authorId: CURRENT_USER_ID,
        images: [art],
        caption: clean || "new photo 📸",
        hashtags: extractHashtags(clean),
        likes: 0,
        liked: false,
        dislikes: 0,
        disliked: false,
        saved: false,
        following: false,
        hidden: false,
        comments: [],
        createdAt: new Date().toISOString(),
      };
      setPhotos((prev) => [post, ...prev]);
      toast("Photo shared 📸", "success");
    },
    [settings.toxicFilter, toast],
  );

  const sendFriendRequest = useCallback(
    (userId: string) => {
      setSentRequests((prev) => {
        if (prev.includes(userId)) {
          toast("Request withdrawn", "default");
          return prev.filter((id) => id !== userId);
        }
        toast("Cliq Up request sent ⚡", "success");
        return [...prev, userId];
      });
    },
    [toast],
  );

  const acceptNotification = useCallback(
    (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, requestState: "accepted" } : n)),
      );
      const n = notifications.find((x) => x.id === id);
      if (n) {
        setFriendIds((prev) => (prev.includes(n.actorId) ? prev : [...prev, n.actorId]));
        setMe((prev) => ({ ...prev, friends: prev.friends + 1 }));
      }
      toast("Cliq Up accepted ⚡ You're in their Cliq", "success");
    },
    [notifications, toast],
  );

  const declineNotification = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true, requestState: "declined" } : n)));
      toast("Request declined", "default");
    },
    [toast],
  );

  const markNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const openConversation = useCallback((personId: string) => {
    setConversations((prev) => {
      const existing = prev.find((c) => c.personId === personId);
      if (existing) {
        return prev.map((c) => (c.personId === personId ? { ...c, unread: 0 } : c));
      }
      const fresh: Conversation = {
        id: makeId("dm"),
        personId,
        unread: 0,
        typing: false,
        pinned: false,
        messages: [],
      };
      return [fresh, ...prev];
    });
    setConversations((prev) => {
      const conv = prev.find((c) => c.personId === personId);
      if (conv) setActiveConversationId(conv.id);
      return prev;
    });
  }, []);

  const sendMessage = useCallback(
    (text?: string, media?: ArtSeed) => {
      const clean = text ? censor(text.trim(), settings.toxicFilter) : "";
      if (!clean && !media) return;
      const conv = conversations.find((c) => c.id === activeConversationId);
      if (!conv) return;
      const message: ChatMessage = {
        id: makeId("msg"),
        fromMe: true,
        text: clean || undefined,
        media,
        createdAt: new Date().toISOString(),
        reactions: [],
        myReaction: null,
      };
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId ? { ...c, messages: [...c.messages, message] } : c)),
      );

      setConversations((prev) => prev.map((c) => (c.id === activeConversationId ? { ...c, typing: true } : c)));
      const replies = SUGGESTED_REPLIES;
      const replyText = replies[Math.floor(Math.random() * replies.length)];
      const timer = setTimeout(() => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId
              ? {
                  ...c,
                  typing: false,
                  messages: [
                    ...c.messages,
                    {
                      id: makeId("msg"),
                      fromMe: false,
                      text: replyText,
                      createdAt: new Date().toISOString(),
                      reactions: [],
                      myReaction: null,
                    },
                  ],
                }
              : c,
          ),
        );
      }, 1500);
      replyTimers.current.push(timer);
    },
    [activeConversationId, conversations, settings.toxicFilter],
  );

  const reactToMessage = useCallback(
    (messageId: string, emoji: string) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          messages: c.messages.map((msg) => {
            if (msg.id !== messageId) return msg;
            const reactions = deepClone(msg.reactions);
            if (msg.myReaction === emoji) {
              const existing = reactions.find((r) => r.emoji === emoji);
              if (existing) {
                existing.count -= 1;
                if (existing.count <= 0) {
                  return { ...msg, reactions: reactions.filter((r) => r.emoji !== emoji), myReaction: null };
                }
              }
              return { ...msg, reactions, myReaction: null };
            }
            const previous = msg.myReaction;
            if (previous) {
              const prevReaction = reactions.find((r) => r.emoji === previous);
              if (prevReaction) {
                prevReaction.count -= 1;
                if (prevReaction.count <= 0) reactions.splice(reactions.indexOf(prevReaction), 1);
              }
            }
            const target = reactions.find((r) => r.emoji === emoji);
            if (target) target.count += 1;
            else reactions.push({ emoji, count: 1 });
            return { ...msg, reactions, myReaction: emoji };
          }),
        })),
      );
    },
    [],
  );

  const clearChat = useCallback(
    (conversationId: string) => {
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, messages: [] } : c)));
      toast("Chat cleared", "default");
    },
    [toast],
  );

  const blockUser = useCallback(
    (personId: string) => {
      setConversations((prev) => prev.filter((c) => c.personId !== personId));
      toast("User blocked 🛡️", "danger");
    },
    [toast],
  );

  const updateProfile = useCallback(
    (patch: Partial<Pick<UserProfile, "name" | "handle" | "bio" | "interests" | "pronouns">>) => {
      setMe((prev) => ({ ...prev, ...patch }));
      toast("Profile updated ✨", "success");
    },
    [toast],
  );

  const userMap = useMemo<Record<string, CliqUser>>(() => {
    const map: Record<string, CliqUser> = {};
    for (const u of USERS) map[u.id] = u;
    map[CURRENT_USER_ID] = { ...me };
    return map;
  }, [me]);

  const value: CliqContextValue = {
    me,
    users: USERS,
    userMap,
    videos,
    photos,
    chatPosts,
    conversations,
    notifications,
    settings,
    tab,
    activeConversationId,
    friendIds,
    sentRequests,
    followingIds,
    searchQuery,
    toasts,
    createOpen,
    createMode,
    profileTab,
    setTab,
    setSearch,
    setCreateOpen,
    setCreateMode,
    setProfileTab,
    updateSettings,
    resetData,
    toggleVideoLike,
    toggleVideoSave,
    toggleVideoRepost,
    toggleFollow,
    toggleFollowingId,
    addComment,
    toggleCommentLike,
    togglePhotoLike,
    togglePhotoDislike,
    togglePhotoSave,
    hidePhoto,
    voteChatPost,
    toggleChatRepost,
    toggleChatSave,
    votePoll,
    addChatPost,
    addVideoPost,
    addPhotoPost,
    sendFriendRequest,
    acceptNotification,
    declineNotification,
    markNotificationsRead,
    openConversation,
    sendMessage,
    reactToMessage,
    clearChat,
    blockUser,
    updateProfile,
    toast,
    dismissToast,
  };

  return (
    <CliqContext.Provider key={resetKey} value={value}>
      {children}
    </CliqContext.Provider>
  );
}

export function authorOf(map: Record<string, CliqUser>, id: string): CliqUser {
  return (
    map[id] ?? {
      id,
      name: "Cliq User",
      handle: "cliquser",
      age: 16,
      vibe: "New here",
      bio: "",
      interests: [],
      online: false,
      avatar: ["#8b5cf6", "#22d3ee"],
    }
  );
}

export const NOTIFICATION_LABEL: Record<NotificationKind, string> = {
  like: "Like",
  upgrade: "Upgrade",
  comment: "Comment",
  cliqup: "Cliq Up",
  message: "Message",
};

export function nowIso(): string {
  return new Date().toISOString();
}

export { clockTime, minutesAgo };
