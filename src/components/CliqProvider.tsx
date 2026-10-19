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
import useSWR from "swr";
import { ApiClientError, api, swrFetcher } from "@/lib/api-client";
import { feedKey } from "@/components/tabs/useFeed";
import {
  DEFAULT_SETTINGS,
  type SessionUser,
  type Post,
  type PublicUser,
  type Settings,
  type TabKey,
  type Toast,
  type UnreadCounts,
} from "@/types/cliq";

interface CliqContextValue {
  /** null while the session is being resolved; false-ish once loaded = logged out */
  user: SessionUser | null;
  loading: boolean;
  fallbackMode: boolean;
  /** underlying database error text, when one has occurred */
  dbError: string | null;
  /** true when Cloudinary env vars are missing, so uploads are unavailable */
  mediaUnconfigured: boolean;
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  createOpen: boolean;
  setCreateOpen: (open: boolean) => void;
  /** Send a friendly one-tap wave (a DM) to a friend. */
  sendWave: (userId: string) => Promise<void>;
  /** Open the Profile tab straight into its Settings panel. */
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  /** Global search query, shared by the header, feed tabs and the trend rail. */
  search: string;
  setSearch: (value: string) => void;
  /** User to jump straight into a DM with (set by the rail / notes bar). */
  chatTarget: PublicUser | null;
  openChat: (user: PublicUser) => void;
  clearChatTarget: () => void;
  toasts: Toast[];
  toast: (text: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: string) => void;
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  refreshUser: () => Promise<void>;
  logOut: () => Promise<void>;
  /** Shared "bump" so tabs refetch when data changes elsewhere. */
  revision: number;
  bump: () => void;
  /** Post ids the user has locally marked saved. */
  savedIds: string[];
  toggleSaved: (postId: string) => void;
  /** Users the signed-in account follows (derived from friendships.outgoing). */
  followingIds: string[];
  /** Send/withdraw a Cliq Up. Optimistic, reconciled against the server. */
  toggleFollow: (userId: string) => void;
  /** Re-read the follow graph after it changes elsewhere. */
  refreshFollowing: () => Promise<void>;
  /** Live unread counters (bell + Chats badge). */
  counts: UnreadCounts;
  /** Newest post timestamp per feed, for the "new posts" red dots. */
  feedLatest: { video?: string; photo?: string; chat?: string };
  /** Last time the user opened each feed tab. */
  lastSeen: { video?: string; photo?: string; chat?: string; chatposts?: string };
  /** Record that a tab has been viewed, clearing its dot. */
  markTabSeen: (tab: TabKey) => void;
  apiError: (error: unknown) => void;
}

const CliqContext = createContext<CliqContextValue | null>(null);

export function useCliq(): CliqContextValue {
  const ctx = useContext(CliqContext);
  if (!ctx) throw new Error("useCliq must be used inside CliqProvider");
  return ctx;
}

export function CliqProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [mediaUnconfigured, setMediaUnconfigured] = useState(false);
  const [tab, setTab] = useState<TabKey>("videos");
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [chatTarget, setChatTarget] = useState<PublicUser | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [revision, setRevision] = useState(0);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [counts, setCounts] = useState<UnreadCounts>({ notifications: 0, messages: 0, pendingRequests: 0 });
  const [lastSeen, setLastSeen] = useState<{ video?: string; photo?: string; chat?: string; chatposts?: string }>({});
  const counter = useRef(0);

  const toast = useCallback((text: string, tone: Toast["tone"] = "default") => {
    counter.current += 1;
    const id = `t_${counter.current}_${Date.now()}`;
    setToasts((prev) => [...prev.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const apiError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiClientError) {
        if (error.status === 503) {
          setFallbackMode(true);
          // Keep the underlying cause so Settings can show something actionable.
          setDbError(error.detail ?? error.message);
        }
    toast(error.message,"danger");
      } else {
    toast("Something went wrong. Please try again.","danger");
      }
    },
    [toast],
  );

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Local storage hint so we can surface the D1 setup notice before any request.
  useEffect(() => {
    setMediaUnconfigured(
      !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || !process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
    );
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("cliq:saved");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) setSavedIds(parsed.filter((v): v is string => typeof v === "string"));
      } catch {
        /* ignore malformed */
      }
    }
  }, []);

  const bump = useCallback(() => setRevision((r) => r + 1), []);

  /**
   * Load who we follow.
   *
   * `friendships` holds both directions, so "following" is the set of outgoing
   * requests/acceptances — that is what the Reels "Following" feed filters on.
   */
  const refreshFollowing = useCallback(async () => {
    try {
      const graph = await api.getFriends();
      setFollowingIds([...graph.friends.map((f) => f.id), ...graph.outgoing.map((o) => o.user.id)]);
    } catch {
      // Not fatal — the For You feed still works without it.
      setFollowingIds([]);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setFollowingIds([]);
      return;
    }
    void refreshFollowing();
  }, [user, refreshFollowing]);

  /**
   * Toggle a Cliq Up from anywhere in the app (Reels action column, caption,
   * profile cards). Updates local state first so the button reacts instantly.
   */
  const toggleFollow = useCallback(
    (userId: string) => {
      const isFollowing = followingIds.includes(userId);
      setFollowingIds((prev) => (isFollowing ? prev.filter((id) => id !== userId) : [...prev, userId]));
      if (isFollowing) {
    toast("Removed from your Cliq","default");
        return;
      }
   toast("Cliq Up sent","success");
      void api
        .requestFriend(userId)
        .then(() => refreshFollowing())
        .catch((error) => {
          // Roll back if the request failed.
          setFollowingIds((prev) => prev.filter((id) => id !== userId));
          apiError(error);
        });
    },
    [followingIds, toast, refreshFollowing, apiError],
  );

  const toggleSaved = useCallback((postId: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId];
      window.localStorage.setItem("cliq:saved", JSON.stringify(next));
      return next;
    });
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      if (!user) return;
      const optimistic = { ...user.settings, ...patch };
      setUser({ ...user, settings: optimistic });
      try {
        const { user: updated } = await api.updateProfile({ settings: optimistic });
        setUser(updated);
      } catch (error) {
        setUser({ ...user });
        apiError(error);
      }
    },
    [user, apiError],
  );

  const logOut = useCallback(async () => {
    try {
      await api.logOut();
    } catch {
      /* logging out locally is enough */
    }
    setUser(null);
    setTab("videos");
    setSavedIds([]);
    window.localStorage.removeItem("cliq:saved");
  }, []);

  /** Jump to the Profile tab and open its Settings panel in one tap. */
  const openSettings = useCallback(() => {
    setTab("profile");
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  /** Jump to Chats and open a DM with this user in one tap. */
  const openChat = useCallback((user: PublicUser) => {
    setChatTarget(user);
    setTab("friends");
  }, []);

  const clearChatTarget = useCallback(() => setChatTarget(null), []);

  /**
   * Newest post per feed.
   *
   * These `useSWR` calls reuse the *same* cache keys as the tabs, so SWR serves
   * them from cache — this adds no network traffic, it just observes data the
   * app has already fetched.
   */
  const { data: videoFeed } = useSWR<{ posts: Post[] }>(user ? feedKey("video") : null, swrFetcher);
  const { data: photoFeed } = useSWR<{ posts: Post[] }>(user ? feedKey("photo") : null, swrFetcher);
  const { data: chatFeed } = useSWR<{ posts: Post[] }>(user ? feedKey("chat") : null, swrFetcher);

  const feedLatest = useMemo(() => {
    const newest = (posts?: Post[]) =>
      posts && posts.length > 0 ? posts.reduce((max, p) => (p.createdAt > max ? p.createdAt : max), "") : undefined;
    return {
      video: newest(videoFeed?.posts),
      photo: newest(photoFeed?.posts),
      chat: newest(chatFeed?.posts),
    };
  }, [videoFeed, photoFeed, chatFeed]);

  // Restore what the user had already seen.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("cliq:lastSeen");
      if (raw) setLastSeen(JSON.parse(raw) as typeof lastSeen);
    } catch {
      /* ignore malformed */
    }
  }, []);

  /** Opening a tab clears its red dot immediately. */
  const markTabSeen = useCallback((next: TabKey) => {
    const key = next === "chatposts" ? "chatposts" : next === "videos" ? "video" : next === "photos" ? "photo" : null;
    if (!key) return;
    setLastSeen((prev) => {
      const updated = { ...prev, [key]: new Date().toISOString() };
      try {
        window.localStorage.setItem("cliq:lastSeen", JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  }, []);

  // Poll the lightweight counters so the Chats badge stays live even when the
  // Notification Center is closed.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = await api.listNotifications();
        if (!cancelled) setCounts(response.counts);
      } catch {
        /* keep the last known counts */
      }
    };
    void load();
    const timer = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [user]);

  /**
   * One-tap wave.
   *
   * Just a DM with a friendly greeting — kept in the provider so both the
   * Online rail and the profile card can use it without duplicating the API call.
   */
  const sendWave = useCallback(
    async (userId: string) => {
      await api.sendMessage({ receiverId: userId, content: "\u{1F44B} Wave!" });
      bump();
    },
    [bump],
  );

  const settings = user?.settings ?? DEFAULT_SETTINGS;

  const value = useMemo<CliqContextValue>(
    () => ({
      user,
      loading,
      fallbackMode,
      dbError,
      mediaUnconfigured,
      tab,
      setTab,
      createOpen,
      setCreateOpen,
      settingsOpen,
      openSettings,
      closeSettings,
      search,
      setSearch,
      chatTarget,
      openChat,
      clearChatTarget,
      sendWave,
      toasts,
      toast,
      dismissToast,
      settings,
      updateSettings,
      refreshUser,
      logOut,
      revision,
      bump,
      savedIds,
      toggleSaved,
      followingIds,
      toggleFollow,
      refreshFollowing,
      counts,
      feedLatest,
      lastSeen,
      markTabSeen,
      apiError,
    }),
    [
      user,
      loading,
      fallbackMode,
      dbError,
      mediaUnconfigured,
      tab,
      createOpen,
      settingsOpen,
      openSettings,
      closeSettings,
      search,
      chatTarget,
      openChat,
      clearChatTarget,
      sendWave,
      toasts,
      toast,
      dismissToast,
      settings,
      updateSettings,
      refreshUser,
      logOut,
      revision,
      bump,
      savedIds,
      toggleSaved,
      followingIds,
      toggleFollow,
      refreshFollowing,
      counts,
      feedLatest,
      lastSeen,
      markTabSeen,
      apiError,
    ],
  );

  return <CliqContext.Provider value={value}>{children}</CliqContext.Provider>;
}
