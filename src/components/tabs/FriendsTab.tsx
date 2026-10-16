"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Image as ImageIcon,
  MessageSquarePlus,
  Mic,
  Phone,
  Plus,
  Search,
  Send,
  Shield,
  Smile,
  Sparkles,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar, EmptyState, TypingDots } from "@/components/ui/Primitives";
import { INTEREST_FILTERS, MESSAGE_REACTIONS, EMOJI_QUICKBAR } from "@/data/mockCliqData";
import type { ArtSeed, CliqUser } from "@/types/cliq";
import { cx, timeAgo } from "@/lib/utils";

export function FriendsTab() {
  const [mode, setMode] = useState<"discover" | "chats">("discover");
  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4">
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-1 backdrop-blur-md">
        {(
          [
            { key: "discover", label: "Find Your Cliq", icon: Sparkles },
            { key: "chats", label: "Direct Chats", icon: MessageSquarePlus },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={cx(
              "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition",
              mode === key ? "bg-[var(--accent-grad)] text-white" : "text-zinc-400 hover:text-zinc-100",
            )}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {mode === "discover" ? <Discover /> : <Chats />}
    </div>
  );
}

function Discover() {
  const { users, me, sentRequests, sendFriendRequest, openConversation, setTab, friendIds } = useCliq();
  const [filter, setFilter] = useState("All Vibes");
  const [query, setQuery] = useState("");

  const people = useMemo(() => {
    return users.filter((u) => {
      if (u.id === me.id) return false;
      if (filter !== "All Vibes" && !u.interests.includes(filter)) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !u.name.toLowerCase().includes(q) &&
          !u.handle.toLowerCase().includes(q) &&
          !u.vibe.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [users, me.id, filter, query]);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/70 p-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-grad)] text-white">
            <Users size={17} />
          </span>
          <div>
            <p className="text-sm font-bold text-zinc-100">Meet teens who match your vibe</p>
            <p className="text-[11px] text-zinc-500">
              {people.length} people online &amp; into {filter === "All Vibes" ? "everything" : filter}
            </p>
          </div>
        </div>

        <div className="relative mt-3">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, @handle or vibe..."
            className="h-10 w-full rounded-full border border-zinc-800 bg-zinc-950/60 pl-9 pr-3 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto cliq-no-bar pb-1">
          {INTEREST_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cx(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                filter === f
                  ? "border-transparent bg-[var(--accent-grad)] text-white"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {people.length === 0 ? (
        <EmptyState emoji="🔍" title="No one matches that filter yet" hint="Try another vibe or clear your search." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => (
            <ProfileCard
              key={p.id}
              person={p}
              requested={sentRequests.includes(p.id)}
              isFriend={friendIds.includes(p.id)}
              onRequest={() => sendFriendRequest(p.id)}
              onMessage={() => {
                openConversation(p.id);
                setTab("friends");
                document.getElementById("cliq-chat-window")?.scrollIntoView({ behavior: "smooth" });
              }}
              myInterests={me.interests}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileCard({
  person,
  requested,
  isFriend,
  onRequest,
  onMessage,
  myInterests,
}: {
  person: CliqUser;
  requested: boolean;
  isFriend: boolean;
  onRequest: () => void;
  onMessage: () => void;
  myInterests: string[];
}) {
  const shared = person.interests.filter((i) => myInterests.includes(i));
  return (
    <div className="cliq-rise flex flex-col rounded-3xl border border-zinc-800/80 bg-zinc-900/80 p-4 backdrop-blur-md transition hover:border-zinc-700">
      <div className="flex items-start gap-3">
        <Avatar user={person} size={54} ring={person.online} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-zinc-100">{person.name}</p>
          <p className="truncate text-[11px] text-zinc-500">
            @{person.handle} · {person.age}
          </p>
          <span className="mt-1 inline-flex rounded-full border border-zinc-700/70 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
            {person.online ? "Online now" : "Offline"}
          </span>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-zinc-400">{person.bio}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {person.interests.map((i) => (
          <span
            key={i}
            className={cx(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              shared.includes(i)
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-2)]"
                : "border-zinc-800 text-zinc-400",
            )}
          >
            {i}
          </span>
        ))}
      </div>
      {shared.length > 0 ? (
        <p className="mt-2 text-[11px] font-semibold text-emerald-400">
          {shared.length} shared interest{shared.length > 1 ? "s" : ""} ⚡
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onRequest}
          disabled={isFriend}
          className={cx(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-60",
            requested
              ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
              : "bg-[var(--accent-grad)] text-white hover:brightness-110",
          )}
        >
          {isFriend ? (
            <>
              <Check size={13} /> In Cliq
            </>
          ) : requested ? (
            <>
              <Check size={13} /> Cliq Request Sent ✓
            </>
          ) : (
            <>
              <UserPlus size={13} /> Cliq Up ⚡
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onMessage}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2 text-xs font-bold text-zinc-300 transition hover:border-[var(--accent)] hover:text-zinc-100"
        >
          <Send size={13} /> Message
        </button>
      </div>
    </div>
  );
}

function Chats() {
  const { conversations, userMap, openConversation, activeConversationId } = useCliq();
  const [query, setQuery] = useState("");

  const list = conversations.filter((c) => {
    const p = userMap[c.personId];
    if (!p) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.handle.toLowerCase().includes(q) ||
      c.messages.some((m) => m.text?.toLowerCase().includes(q))
    );
  });

  const onlinePeople = Object.values(userMap).filter((u) => u.id !== "u_me" && u.online);

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <aside className="rounded-3xl border border-zinc-800/80 bg-zinc-900/70 p-3 backdrop-blur-md">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            className="h-10 w-full rounded-full border border-zinc-800 bg-zinc-950/60 pl-9 pr-3 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="mt-3">
          <p className="px-1 text-[11px] font-bold uppercase tracking-widest text-zinc-500">Online now</p>
          <div className="mt-2 flex gap-3 overflow-x-auto cliq-no-bar pb-1">
            {onlinePeople.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openConversation(p.id)}
                className="flex w-14 shrink-0 flex-col items-center gap-1"
              >
                <Avatar user={p} size={46} />
                <span className="w-full truncate text-center text-[10px] font-semibold text-zinc-400">
                  {p.name.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="cliq-scroll mt-3 max-h-[26rem] space-y-1 overflow-y-auto">
          {list.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-zinc-500">No conversations yet.</p>
          ) : (
            list.map((c) => {
              const p = userMap[c.personId];
              if (!p) return null;
              const last = c.messages[c.messages.length - 1];
              const active = c.id === activeConversationId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openConversation(c.personId)}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition",
                    active ? "bg-[var(--accent-soft)]" : "hover:bg-zinc-800/60",
                  )}
                >
                  <Avatar user={p} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold text-zinc-100">{p.name}</span>
                      {last ? <span className="shrink-0 text-[10px] text-zinc-500">{timeAgo(last.createdAt)}</span> : null}
                    </div>
                    <p className="truncate text-[11px] text-zinc-500">
                      {c.typing ? "typing..." : last ? (last.fromMe ? "You: " : "") + (last.text ?? "📷 Photo") : "Start the convo"}
                    </p>
                  </div>
                  {c.unread > 0 ? (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-[var(--accent-grad)] px-1 text-[10px] font-bold text-white">
                      {c.unread}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        <button
          type="button"
          onClick={() => openConversation(onlinePeople[0]?.id ?? "u_maya")}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-zinc-700 px-3 py-2.5 text-xs font-semibold text-zinc-400 transition hover:border-[var(--accent)] hover:text-zinc-100"
        >
          <Plus size={14} /> New chat
        </button>
      </aside>

      <ChatWindow />
    </div>
  );
}

function ChatWindow() {
  const {
    conversations,
    userMap,
    activeConversationId,
    sendMessage,
    reactToMessage,
    clearChat,
    blockUser,
    toast,
  } = useCliq();
  const conv = conversations.find((c) => c.id === activeConversationId) ?? conversations[0];
  const [draft, setDraft] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [mediaMode, setMediaMode] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const person = conv ? userMap[conv.personId] : undefined;

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [conv?.messages.length, conv?.typing, conv]);

  if (!conv || !person) {
    return <EmptyState emoji="💬" title="Pick a conversation" hint="Choose a friend on the left to start chatting." />;
  }

  const mediaPresets: ArtSeed[] = [
    { from: "#7c3aed", to: "#22d3ee", tint: "#e879f9", emoji: "📸", label: "Snapshot" },
    { from: "#e11d48", to: "#f472b6", tint: "#fb7185", emoji: "🎵", label: "Track" },
    { from: "#059669", to: "#a3e635", tint: "#22c55e", emoji: "🏀", label: "Clip" },
  ];

  return (
    <section
      id="cliq-chat-window"
      className="flex h-[34rem] flex-col overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/70 backdrop-blur-md lg:h-[38rem]"
    >
      <header className="flex items-center gap-3 border-b border-zinc-800/80 px-4 py-3">
        <Avatar user={person} size={42} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-zinc-100">{person.name}</p>
          <p className="truncate text-[11px] text-zinc-500">
            @{person.handle} ·{" "}
            {conv.typing ? (
              <span className="inline-flex items-center gap-1 text-[var(--accent-2)]">
                typing <TypingDots />
              </span>
            ) : person.online ? (
              <span className="text-emerald-400">Online</span>
            ) : (
              "Offline"
            )}
          </p>
        </div>
        <button
          type="button"
          aria-label="Voice call"
          onClick={() => toast(`Calling ${person.name.split(" ")[0]}... 📞`, "success")}
          className="grid h-9 w-9 place-items-center rounded-full border border-zinc-800 text-zinc-300 transition hover:border-[var(--accent)] hover:text-zinc-100"
        >
          <Phone size={16} />
        </button>
        <button
          type="button"
          aria-label="Video call"
          onClick={() => toast(`Starting video call with ${person.name.split(" ")[0]}... 🎥`, "success")}
          className="grid h-9 w-9 place-items-center rounded-full border border-zinc-800 text-zinc-300 transition hover:border-[var(--accent)] hover:text-zinc-100"
        >
          <Video size={16} />
        </button>
        <div className="relative">
          <button
            type="button"
            aria-label="Safety menu"
            onClick={() => setSafetyOpen((v) => !v)}
            className="grid h-9 w-9 place-items-center rounded-full border border-zinc-800 text-zinc-300 transition hover:border-emerald-500/60 hover:text-emerald-300"
          >
            <Shield size={16} />
          </button>
          {safetyOpen ? (
            <>
              <button
                type="button"
                aria-label="Close safety menu"
                onClick={() => setSafetyOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="cliq-pop absolute right-0 top-11 z-20 w-44 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/95 py-1 shadow-2xl backdrop-blur-xl">
                {[
                  { label: "Block User", run: () => blockUser(person.id) },
                  { label: "Report", run: () => toast("Report sent to safety team 🛡️", "danger") },
                  { label: "Clear Chat", run: () => clearChat(conv.id) },
                ].map(({ label, run }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      run();
                      setSafetyOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800/70 hover:text-zinc-100"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </header>

      <div ref={feedRef} className="cliq-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {conv.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="text-3xl">👋</span>
            <p className="text-xs text-zinc-400">Say hi to {person.name.split(" ")[0]} on Cliq!</p>
          </div>
        ) : (
          conv.messages.map((msg) => (
            <div key={msg.id} className={cx("group flex flex-col", msg.fromMe ? "items-end" : "items-start")}>
              <div className={cx("relative max-w-[78%]")}>
                <button
                  type="button"
                  onClick={() => setReactFor((prev) => (prev === msg.id ? null : msg.id))}
                  className={cx(
                    "block w-full rounded-2xl px-3.5 py-2 text-left text-sm shadow-sm transition active:scale-[0.99]",
                    msg.fromMe
                      ? "bg-[var(--accent-grad)] text-white"
                      : "border border-zinc-800/80 bg-zinc-950/70 text-zinc-100",
                  )}
                >
                  {msg.media ? (
                    <span className="mb-1.5 block overflow-hidden rounded-xl">
                      <span
                        className="grid h-28 w-40 place-items-center text-3xl"
                        style={{
                          background: `linear-gradient(140deg, ${msg.media.from}, ${msg.media.to})`,
                        }}
                      >
                        {msg.media.emoji}
                      </span>
                    </span>
                  ) : null}
                  {msg.text ? <span className="whitespace-pre-wrap break-words">{msg.text}</span> : null}
                </button>
                {msg.reactions.length > 0 ? (
                  <div className={cx("mt-1 flex gap-1", msg.fromMe ? "justify-end" : "justify-start")}>
                    {msg.reactions.map((r) => (
                      <span
                        key={r.emoji}
                        className={cx(
                          "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                          msg.myReaction === r.emoji
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-zinc-100"
                            : "border-zinc-800 bg-zinc-900 text-zinc-300",
                        )}
                      >
                        {r.emoji} {r.count}
                      </span>
                    ))}
                  </div>
                ) : null}

                {reactFor === msg.id ? (
                  <div
                    className={cx(
                      "cliq-pop absolute z-20 flex gap-0.5 rounded-full border border-zinc-800/80 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-xl",
                      msg.fromMe ? "right-0 -top-11" : "left-0 -top-11",
                    )}
                  >
                    {MESSAGE_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          reactToMessage(msg.id, emoji);
                          setReactFor(null);
                        }}
                        className="grid h-7 w-7 place-items-center rounded-full text-sm transition hover:bg-zinc-800"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <span className="mt-0.5 px-1 text-[10px] text-zinc-600">
                {msg.fromMe ? "You · " : ""}
                {timeAgo(msg.createdAt)}
              </span>
            </div>
          ))
        )}
        {conv.typing ? (
          <div className="flex items-center gap-2">
            <Avatar user={person} size={26} showOnline={false} />
            <span className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 px-3 py-2 text-zinc-400">
              <TypingDots />
            </span>
          </div>
        ) : null}
      </div>

      {mediaMode ? (
        <div className="flex gap-2 border-t border-zinc-800/80 px-4 py-2.5">
          {mediaPresets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                sendMessage(undefined, preset);
                setMediaMode(false);
              }}
              className="overflow-hidden rounded-xl border border-zinc-800"
            >
              <span
                className="grid h-14 w-20 place-items-center text-xl"
                style={{ background: `linear-gradient(140deg, ${preset.from}, ${preset.to})` }}
              >
                {preset.emoji}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {showEmoji ? (
        <div className="flex flex-wrap gap-1 border-t border-zinc-800/80 px-4 py-2.5">
          {EMOJI_QUICKBAR.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setDraft((d) => d + emoji)}
              className="grid h-8 w-8 place-items-center rounded-lg text-lg transition hover:bg-zinc-800"
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}

      <footer className="flex items-center gap-1.5 border-t border-zinc-800/80 px-3 py-3">
        <button
          type="button"
          aria-label="Emoji"
          onClick={() => setShowEmoji((v) => !v)}
          className={cx(
            "grid h-9 w-9 place-items-center rounded-full transition",
            showEmoji ? "text-[var(--accent-2)]" : "text-zinc-400 hover:text-zinc-100",
          )}
        >
          <Smile size={19} />
        </button>
        <button
          type="button"
          aria-label="Attach media"
          onClick={() => setMediaMode((v) => !v)}
          className={cx(
            "grid h-9 w-9 place-items-center rounded-full transition",
            mediaMode ? "text-[var(--accent-2)]" : "text-zinc-400 hover:text-zinc-100",
          )}
        >
          <ImageIcon size={19} />
        </button>
        <button
          type="button"
          aria-label="Voice note"
          onClick={() => toast("Voice notes coming soon 🎙️", "default")}
          className="grid h-9 w-9 place-items-center rounded-full text-zinc-400 transition hover:text-zinc-100"
        >
          <Mic size={19} />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              sendMessage(draft);
              setDraft("");
            }
          }}
          placeholder={`Message ${person.name.split(" ")[0]}...`}
          className="h-10 min-w-0 flex-1 rounded-full border border-zinc-800 bg-zinc-950/70 px-4 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
        />
        <button
          type="button"
          aria-label="Send message"
          onClick={() => {
            if (draft.trim() || mediaMode) {
              sendMessage(draft);
              setDraft("");
            }
          }}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--accent-grad)] text-white transition active:scale-90"
        >
          <Send size={17} />
        </button>
      </footer>
    </section>
  );
}
