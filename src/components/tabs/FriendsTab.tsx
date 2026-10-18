"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CornerUpLeft,
  Image as ImageIcon,
  Info,
  Mic,
  Pause,
  Play,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { StoryNotesBar } from "@/components/stories/StoryNotesBar";
import { GroupChats } from "@/components/chats/GroupChats";
import { api } from "@/lib/api-client";
import { uploadMedia } from "@/lib/cloudinary";
import { refreshNotifications } from "@/components/notifications/useNotificationCenter";
import { Avatar, EmptyState, Skeleton, Spinner, TypingDots } from "@/components/ui/Primitives";
import { INTEREST_FILTERS, MESSAGE_REACTIONS } from "@/lib/constants";
import { formatDuration, isAudioUrl, useVoiceRecorder } from "@/lib/voice-recorder";
import type { ConversationSummary, FriendGraph, Message, PublicUser } from "@/types/cliq";
import { clockTime, cx, timeAgo } from "@/lib/utils";

const POLL_INTERVAL_MS = 3000;

type Mode = "discover" | "chats" | "groups";

export function FriendsTab({
  search,
  onDataChanged,
  onOpenProfile,
}: {
  search: string;
  onDataChanged: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("chats");
  const [openPartner, setOpenPartner] = useState<PublicUser | null>(null);
  const { counts, chatTarget, clearChatTarget } = useCliq();

  // A "jump to DM" from the notes bar or the right rail opens Chats directly.
  useEffect(() => {
    if (!chatTarget) return;
    setMode("chats");
    setOpenPartner(chatTarget);
    clearChatTarget();
  }, [chatTarget, clearChatTarget]);

  return (
    <div className="flex h-screen flex-col">
      {/* Mode switcher: Messages / Discover / Groups */}
      <div
        className={cx(
          "flex items-center gap-1 border-b border-zinc-800/80 px-3 py-2",
          openPartner && "hidden lg:flex",
        )}
      >
        {(
          [
            { key: "chats", label: "Messages", badge: counts.messages },
            { key: "discover", label: "Discover People", badge: counts.pendingRequests },
            { key: "groups", label: "Groups", badge: 0 },
          ] as const
        ).map(({ key, label, badge }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMode(key);
              setOpenPartner(null);
            }}
            className={cx(
              "relative rounded-full px-3.5 py-1.5 text-sm transition",
              mode === key ? "bg-white font-semibold text-black" : "text-zinc-400 hover:text-zinc-100",
            )}
          >
            {label}
            {badge > 0 ? (
              <span className="ml-1.5 inline-grid h-[16px] min-w-[16px] place-items-center rounded-full bg-[#ff3040] px-1 text-[10px] font-bold text-white">
                {badge > 9 ? "9+" : badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className={cx("flex-1 overflow-hidden", openPartner && "hidden lg:block")}>
        <div className="mb-0 border-b border-zinc-800/80 px-3 py-2">
          <StoryNotesBar onOpenProfile={onOpenProfile} />
        </div>
      </div>

      <div className={cx("min-h-0 flex-1 overflow-hidden", openPartner && "hidden lg:flex")}>
        {mode === "discover" ? (
          <Discover
            search={search}
            onMessage={(user) => {
              setMode("chats");
              setOpenPartner(user);
            }}
            onDataChanged={onDataChanged}
            onOpenProfile={onOpenProfile}
          />
        ) : mode === "groups" ? (
          <div className="cliq-scroll h-full overflow-y-auto p-4">
            <GroupChats onOpenProfile={onOpenProfile} />
          </div>
        ) : (
          <Chats
            openPartner={openPartner}
            setOpenPartner={setOpenPartner}
            onDataChanged={onDataChanged}
            onOpenProfile={onOpenProfile}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ discover */

function Discover({
  search,
  onMessage,
  onDataChanged,
  onOpenProfile,
}: {
  search: string;
  onMessage: (user: PublicUser) => void;
  onDataChanged: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const { user, toast, apiError } = useCliq();
  const [filter, setFilter] = useState("All Vibes");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PublicUser[]>([]);
  const [graph, setGraph] = useState<FriendGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const combinedQuery = (query || search).trim();

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const [users, friends] = await Promise.all([
          api.listUsers(combinedQuery || undefined, filter),
          api.getFriends(),
        ]);
        setPeople(users);
        setGraph(friends);
      } catch (error) {
        apiError(error);
      } finally {
        setLoading(false);
      }
    },
    [combinedQuery, filter, apiError],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const friendIds = useMemo(() => new Set(graph?.friends.map((f) => f.id) ?? []), [graph]);
  const outgoingIds = useMemo(() => new Set(graph?.outgoing.map((o) => o.user.id) ?? []), [graph]);

  async function follow(target: PublicUser) {
    setBusyId(target.id);
    try {
      const updated = await api.requestFriend(target.id);
      setGraph(updated);
      toast(`Follow request sent to @${target.username}`, "success");
      onDataChanged();
    } catch (error) {
      apiError(error);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="cliq-scroll h-full overflow-y-auto p-4">
      <div className="relative">
        <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people"
          className="h-10 w-full rounded-lg border border-zinc-800/80 bg-[#121317] pl-9 pr-3 text-sm text-white outline-none focus:border-zinc-600"
        />
      </div>

      <div className="cliq-no-bar mt-3 flex gap-2 overflow-x-auto pb-1">
        {INTEREST_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cx(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs transition",
              filter === f ? "bg-white font-semibold text-black" : "bg-[#121317] text-zinc-400 hover:text-zinc-200",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : people.length === 0 ? (
        <EmptyState
          icon={<Users size={26} strokeWidth={1.75} />}
          title={combinedQuery || filter !== "All Vibes" ? "No one matches that filter" : "No one else is here yet"}
          hint={
            combinedQuery || filter !== "All Vibes"
              ? "Try another vibe or clear your search."
              : "Invite a friend to sign up — as soon as they join they'll appear here."
          }
        />
      ) : (
        <ul className="mt-4">
          {people.map((person) => {
            const isFriend = friendIds.has(person.id);
            const requested = outgoingIds.has(person.id);
            const shared = (person.interests ?? []).filter((i) => (user?.interests ?? []).includes(i));
            return (
              <li key={person.id} className="flex items-center gap-3 border-b border-zinc-800/80 py-3">
                <button
                  type="button"
                  onClick={() => onOpenProfile(person.id)}
                  className="shrink-0 rounded-full"
                  aria-label={`Open ${person.displayName}'s profile`}
                >
                  <Avatar user={person} size={48} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{person.displayName}</p>
                  <p className="truncate text-xs text-zinc-500">
                    @{person.username}
                    {shared.length > 0 ? ` · ${shared.length} shared` : ""}
                  </p>
                  {person.bio ? <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{person.bio}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void follow(person)}
                    disabled={isFriend || requested || busyId === person.id}
                    className={cx(
                      "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
                      isFriend || requested
                        ? "bg-[#18181b] text-zinc-400"
                        : "bg-[#4f46e5] text-white hover:bg-[#6366f1] disabled:opacity-50",
                    )}
                  >
                    {busyId === person.id ? <Spinner className="h-3 w-3" /> : isFriend || requested ? "Following" : "Follow"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMessage(person)}
                    className="rounded-lg bg-[#18181b] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#27272a]"
                  >
                    Message
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- chats */

function Chats({
  openPartner,
  setOpenPartner,
  onDataChanged,
  onOpenProfile,
}: {
  openPartner: PublicUser | null;
  setOpenPartner: (user: PublicUser | null) => void;
  onDataChanged: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const { apiError } = useCliq();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const loadConversations = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const list = await api.listConversations();
        setConversations(list);
      } catch (error) {
        apiError(error);
      } finally {
        setLoading(false);
      }
    },
    [apiError],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const timer = setInterval(() => void loadConversations(true), POLL_INTERVAL_MS * 2);
    return () => clearInterval(timer);
  }, [loadConversations]);

  const filtered = conversations.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.partner.username.toLowerCase().includes(q) ||
      c.partner.displayName.toLowerCase().includes(q) ||
      (c.lastMessage?.content ?? "").toLowerCase().includes(q)
    );
  });

  const activePartner = openPartner ?? null;

  return (
    <div className="flex h-full min-h-0">
      {/* Inbox column */}
      <aside
        data-testid="conversation-list"
        className={cx(
          "flex h-full w-full flex-col border-r border-zinc-800/80 md:w-[360px]",
          openPartner && "hidden md:flex",
        )}
      >
        <div className="flex h-[60px] items-center justify-between border-b border-zinc-800/80 px-5">
          <span className="text-base font-bold text-white">Messages</span>
          <button
            type="button"
            onClick={() => setOpenPartner(null)}
            aria-label="New message"
            className="text-zinc-400 transition hover:text-white"
          >
            <UserPlus size={20} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-5 py-2.5">
          <div className="relative">
            <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages"
              className="h-9 w-full rounded-full border border-zinc-800/80 bg-[#121317] pl-9 pr-3 text-sm text-white outline-none focus:border-zinc-600"
            />
          </div>
        </div>

        <div className="cliq-scroll min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-1 p-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-13 w-13 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2.5 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-500">
              {conversations.length === 0 ? "No messages yet." : "No messages match that search."}
            </p>
          ) : (
            filtered.map((c) => {
              const active = activePartner?.id === c.partner.id;
              return (
                <button
                  key={c.partner.id}
                  type="button"
                  onClick={() => setOpenPartner(c.partner)}
                  className={cx(
                    "flex w-full items-center gap-3 px-5 py-3 text-left transition",
                    active ? "bg-[#121317]" : "hover:bg-[#121317]",
                  )}
                >
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenProfile(c.partner.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.stopPropagation();
                        onOpenProfile(c.partner.id);
                      }
                    }}
                    aria-label={`Open ${c.partner.displayName}'s profile`}
                    className="shrink-0 rounded-full"
                  >
                    <Avatar user={c.partner} size={52} online />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cx("truncate text-sm", c.unreadCount > 0 ? "font-bold text-white" : "font-medium text-zinc-200")}>
                        {c.partner.displayName}
                      </span>
                      {c.lastMessage ? (
                        <span className="shrink-0 text-xs text-zinc-500">{timeAgo(c.lastMessage.createdAt)}</span>
                      ) : null}
                    </div>
                    <p className={cx("truncate text-xs", c.unreadCount > 0 ? "text-zinc-200" : "text-zinc-500")}>
                      {c.lastMessage
                        ? `${c.lastMessage.senderId === c.partner.id ? "" : "You: "}${
                            c.lastMessage.content || "Photo"
                          }`
                        : "No messages yet"}
                    </p>
                  </div>
                  {c.unreadCount > 0 ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#0095F6]" /> : null}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Active chat pane */}
      <div className={cx("min-w-0 flex-1", !openPartner && "hidden md:flex")}>
        {activePartner ? (
          <ChatWindow
            key={activePartner.id}
            partner={activePartner}
            onBack={() => setOpenPartner(null)}
            onOpenProfile={onOpenProfile}
            onChanged={() => {
              void loadConversations(true);
              onDataChanged();
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full border border-zinc-800/80 text-zinc-600">
                <Send size={26} strokeWidth={1.5} />
              </span>
              <p className="text-lg font-semibold text-zinc-200">Your messages</p>
              <p className="max-w-xs text-sm text-zinc-500">
                Send a message to start a chat, or discover new people to follow.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- chat window */

function ChatWindow({
  partner,
  onBack,
  onChanged,
  onOpenProfile,
}: {
  partner: PublicUser;
  onBack: () => void;
  onChanged: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const { user, toast, apiError, settings } = useCliq();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const voice = useVoiceRecorder();
  const feedRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const scrollToBottom = useCallback((smooth = false) => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const fetchMessages = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        const list = await api.listMessages(partner.id);
        if (opts?.silent) {
          const incoming = list.filter((m) => !m.fromMe && !seenIds.current.has(m.id));
          const newest = list[list.length - 1];
          if (incoming.length > 0 && newest && !newest.fromMe) {
            setPartnerTyping(true);
            setTimeout(() => setPartnerTyping(false), 1200);
          }
        }
        seenIds.current = new Set(list.map((m) => m.id));
        setMessages(list);
        if (!opts?.silent) setTimeout(() => scrollToBottom(), 0);
      } catch (error) {
        if (!opts?.silent) apiError(error);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [partner.id, apiError, scrollToBottom],
  );

  useEffect(() => {
    seenIds.current = new Set();
    setMessages([]);
    setLoading(true);
    setReplyTo(null);
    setMediaUrl(null);
    void fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const timer = setInterval(() => void fetchMessages({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchMessages]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.markConversationRead(partner.id);
        if (!cancelled) void refreshNotifications();
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partner.id]);

  async function send(overrideMedia?: string) {
    const content = draft.trim();
    const media = overrideMedia ?? mediaUrl;
    if ((!content && !media) || sending) return;

    const optimisticId = `optimistic_${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      senderId: user?.id ?? "me",
      receiverId: partner.id,
      content,
      mediaUrl: media,
      replyToId: replyTo?.id ?? null,
      replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, senderId: replyTo.senderId } : null,
      reactions: [],
      isRead: false,
      createdAt: new Date().toISOString(),
      fromMe: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setMediaUrl(null);
    setReplyTo(null);
    setSending(true);

    try {
      const { message } = await api.sendMessage({
        receiverId: partner.id,
        content,
        mediaUrl: media,
        replyToId: optimistic.replyToId,
      });
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? message : m)));
      seenIds.current.add(message.id);
      onChanged();
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setDraft(content);
      apiError(error);
    } finally {
      setSending(false);
    }
  }

  async function finishVoiceNote() {
    const blob = await voice.stop();
    if (!blob) return;
    const ext = blob.type.includes("mp4") ? "m4a" : "webm";
    const file = new File([blob], `voice-note.${ext}`, { type: blob.type || "audio/webm" });
    toast("Sending voice note…", "default");
    try {
      const result = await uploadMedia(file, { compress: false });
      await send(result.secureUrl);
    } catch {
      const localUrl = URL.createObjectURL(blob);
      await send(localUrl);
    }
  }

  async function react(messageId: string, emoji: string) {
    setReactFor(null);
    try {
      const { message } = await api.reactToMessage(messageId, emoji);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
    } catch (error) {
      apiError(error);
    }
  }

  async function unsend(messageId: string) {
    try {
      await api.deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast("Message unsent", "default");
      onChanged();
    } catch (error) {
      apiError(error);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-black">
      <header className="flex h-[60px] items-center gap-3 border-b border-zinc-800/80 px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="text-zinc-300 transition hover:text-white md:hidden"
        >
          <ArrowLeft size={20} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={() => onOpenProfile(partner.id)}
          className="shrink-0 rounded-full"
          aria-label={`Open ${partner.displayName}'s profile`}
        >
          <Avatar user={partner} size={40} online />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpenProfile(partner.id)}
            className="block max-w-full truncate text-left text-sm font-semibold text-white"
          >
            {partner.displayName}
          </button>
          <p className="truncate text-xs text-zinc-500">
            @{partner.username}
            {partnerTyping ? (
              <span className="ml-1 inline-flex items-center gap-1 text-[#4f46e5]">
                · typing <TypingDots />
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          aria-label="Conversation info"
          onClick={() => onOpenProfile(partner.id)}
          className="text-zinc-400 transition hover:text-white"
        >
          <Info size={20} strokeWidth={1.75} />
        </button>
      </header>

      <div data-testid="message-feed" ref={feedRef} className="cliq-scroll flex-1 space-y-2 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-xs text-zinc-500">
            <Spinner /> <span className="ml-2">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-zinc-500">
              Say hi to {partner.displayName.split(" ")[0]} — this is the start of your chat.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              partner={partner}
              onReply={() => setReplyTo(msg)}
              onReact={setReactFor}
              reactFor={reactFor}
              onPickReaction={(emoji) => void react(msg.id, emoji)}
              onUnsend={() => void unsend(msg.id)}
              toxicFilter={settings.toxicFilter}
            />
          ))
        )}
        {partnerTyping ? (
          <div className="flex items-center gap-2">
            <Avatar user={partner} size={26} />
            <span className="rounded-[20px] bg-[#18181b] px-4 py-2.5 text-zinc-400">
              <TypingDots />
            </span>
          </div>
        ) : null}
      </div>

      {replyTo ? (
        <div className="flex items-center gap-2 border-t border-zinc-800/80 px-4 py-2">
          <CornerUpLeft size={14} strokeWidth={1.75} className="shrink-0 text-zinc-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-zinc-400">
              Replying to {replyTo.fromMe ? "yourself" : `@${partner.username}`}
            </p>
            <p className="truncate text-xs text-zinc-500">{replyTo.content || "Photo"}</p>
          </div>
          <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="text-zinc-500 hover:text-white">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {mediaUrl ? (
        <div className="flex items-center gap-2 border-t border-zinc-800/80 px-4 py-2">
          <ImageIcon size={14} strokeWidth={1.75} className="shrink-0 text-zinc-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-zinc-400">Image attached</p>
            <p className="truncate text-xs text-zinc-500">{mediaUrl.slice(0, 60)}</p>
          </div>
          <button type="button" onClick={() => setMediaUrl(null)} aria-label="Remove image" className="text-zinc-500 hover:text-white">
            <X size={14} />
          </button>
        </div>
      ) : null}

      <footer className="p-4">
        {voice.recording ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Cancel voice note"
              onClick={() => voice.cancel()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:text-[#ff3040]"
            >
              <Trash2 size={18} strokeWidth={1.75} />
            </button>
            <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#ff3040]/40 bg-[#ff3040]/5 px-4">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#ff3040]" />
              <span className="text-sm font-semibold tabular-nums text-zinc-200">{formatDuration(voice.seconds)}</span>
              <span className="ml-1 flex flex-1 items-end gap-0.5 overflow-hidden">
                {Array.from({ length: 24 }).map((_, i) => (
                  <span key={i} className="w-1 rounded-full bg-[#ff3040]/60" style={{ height: `${6 + ((i * 7) % 16)}px` }} />
                ))}
              </span>
            </div>
            <button
              type="button"
              aria-label="Send voice note"
              onClick={() => void finishVoiceNote()}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#4f46e5] text-white transition hover:bg-[#6366f1] active:scale-90"
            >
              <Send size={17} strokeWidth={1.75} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-full border border-zinc-700 bg-black px-4 py-2.5">
            <label className="cursor-pointer text-zinc-400 transition hover:text-white" aria-label="Attach media">
              <ImageIcon size={20} strokeWidth={1.75} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 4.5 * 1024 * 1024) {
                    toast("Keep images under 4.5MB.", "danger");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => setMediaUrl(typeof reader.result === "string" ? reader.result : null);
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            <input
              data-testid="chat-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|avif)(\?\S*)?$/i.test(text.trim())) {
                  e.preventDefault();
                  setMediaUrl(text.trim());
                  toast("Image attached", "success");
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Message..."
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
            <button
              type="button"
              aria-label="Record voice note"
              data-testid="voice-record"
              onClick={() => void voice.start()}
              className="text-zinc-400 transition hover:text-white"
            >
              <Mic size={20} strokeWidth={1.75} />
            </button>
            {draft.trim() || mediaUrl ? (
              <button
                type="button"
                aria-label="Send message"
                onClick={() => void send()}
                disabled={sending}
                className="text-sm font-semibold text-[#4f46e5] transition hover:text-white disabled:opacity-40"
              >
                {sending ? <Spinner className="h-4 w-4" /> : "Send"}
              </button>
            ) : null}
          </div>
        )}
      </footer>
    </section>
  );
}

function MessageBubble({
  message,
  partner,
  onReply,
  onReact,
  reactFor,
  onPickReaction,
  onUnsend,
  toxicFilter,
}: {
  message: Message;
  partner: PublicUser;
  onReply: () => void;
  onReact: (id: string | null) => void;
  reactFor: string | null;
  onPickReaction: (emoji: string) => void;
  onUnsend: () => void;
  toxicFilter: boolean;
}) {
  const mine = message.fromMe;
  const open = reactFor === message.id;
  void toxicFilter;

  return (
    <div className={cx("group flex flex-col", mine ? "items-end" : "items-start")}>
      <div className="relative max-w-[70%]">
        {message.replyTo ? (
          <div className={cx("mb-1 border-l-2 pl-2.5 text-xs text-zinc-400", mine ? "border-zinc-500" : "border-zinc-500")}>
            <p className="font-semibold">{message.replyTo.senderId === partner.id ? `@${partner.username}` : "You"}</p>
            <p className="truncate">{message.replyTo.content || "Photo"}</p>
          </div>
        ) : null}

        <div
          className={cx(
            "rounded-[20px] px-4 py-2.5 text-[15px]",
            mine ? "bg-[#4f46e5] text-white" : "bg-[#18181b] text-[#f5f5f5]",
          )}
        >
          {message.mediaUrl ? (
            isAudioUrl(message.mediaUrl) ? (
              <VoiceNote url={message.mediaUrl} mine={mine} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={message.mediaUrl} alt="Shared media" className="mb-1.5 max-h-64 w-full rounded-xl object-cover" />
            )
          ) : null}
          {message.content ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : null}
        </div>

        {message.reactions.length > 0 ? (
          <div className={cx("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "justify-start")}>
            {message.reactions.map((r) => (
              <span
                key={r.emoji}
                className={cx(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  r.mine ? "bg-[#ff3040]/15 text-[#ff3040]" : "bg-[#18181b] text-zinc-300",
                )}
              >
                <span className={cx(r.mine && "text-[#ff3040]")}>{r.emoji}</span> {r.count}
              </span>
            ))}
          </div>
        ) : null}

        {open ? (
          <>
            <button
              type="button"
              aria-label="Close message actions"
              onClick={() => onReact(null)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div
              className={cx(
                "cliq-pop absolute z-20 w-max rounded-xl border border-zinc-800/80 bg-[#121317] p-1 shadow-2xl",
                mine ? "right-0 top-full mt-1" : "left-0 top-full mt-1",
              )}
            >
              <div className="flex gap-0.5 border-b border-zinc-800/80 pb-1">
                {MESSAGE_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onPickReaction(emoji)}
                    className="grid h-7 w-7 place-items-center rounded-full text-sm transition hover:bg-zinc-800"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex flex-col pt-1">
                <button
                  type="button"
                  onClick={onReply}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                >
                  <CornerUpLeft size={13} strokeWidth={1.75} /> Reply
                </button>
                {mine ? (
                  <button
                    type="button"
                    onClick={onUnsend}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-[#ff3040] hover:bg-zinc-800"
                  >
                    <Trash2 size={13} strokeWidth={1.75} /> Unsend
                  </button>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div className={cx("mt-0.5 flex items-center gap-1 px-1 text-[10px] text-zinc-600", mine && "flex-row-reverse")}>
        <span>{clockTime(message.createdAt)}</span>
        {mine ? (
          <span className={cx("inline-flex items-center gap-0.5", message.isRead ? "text-[#4f46e5]" : "")}>
            {message.isRead ? <CheckCheck size={11} strokeWidth={1.75} /> : <Check size={11} strokeWidth={1.75} />}
          </span>
        ) : null}
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => onReact(message.id)}
          aria-label="Message actions"
          className="mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold text-zinc-600 opacity-0 transition hover:text-zinc-300 group-hover:opacity-100 focus:opacity-100"
        >
          React · Reply
        </button>
      ) : null}
    </div>
  );
}

/**
 * A voice-note bubble: play/pause plus a live waveform-style progress bar.
 * Works for any audio URL (Cloudinary .webm/.mp4, or a local blob during dev).
 */
function VoiceNote({ url, mine }: { url: string; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const bars = 28;

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        className={cx(
          "grid h-8 w-8 shrink-0 place-items-center rounded-full transition active:scale-90",
          mine ? "bg-white/25 text-white" : "bg-[#4f46e5] text-white",
        )}
      >
        {playing ? <Pause size={14} className="fill-current" /> : <Play size={14} className="ml-0.5 fill-current" />}
      </button>
      <span className="flex flex-1 items-center gap-[3px]">
        {Array.from({ length: bars }).map((_, i) => {
          const active = progress * bars > i;
          const height = 6 + ((i * 5) % 15);
          return (
            <span
              key={i}
              className={cx(
                "w-[3px] rounded-full transition-colors",
                active ? (mine ? "bg-white" : "bg-[#4f46e5]") : mine ? "bg-white/40" : "bg-zinc-600",
              )}
              style={{ height }}
            />
          );
        })}
      </span>
      <span className={cx("shrink-0 text-[10px] font-semibold tabular-nums", mine ? "text-white/80" : "text-zinc-400")}>
        {formatDuration(duration)}
      </span>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration && Number.isFinite(el.duration)) setProgress(el.currentTime / el.duration);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        className="hidden"
      />
    </div>
  );
}
