"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Plus,
  Search,
  Send,
  Smile,
  Users,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar, EmptyState, Modal, Skeleton, Spinner } from "@/components/ui/Primitives";
import { EMOJI_QUICKBAR, MESSAGE_REACTIONS } from "@/lib/constants";
import { uploadMedia } from "@/lib/cloudinary";
import { api } from "@/lib/api-client";
import type { Group, GroupMessage, PublicUser } from "@/types/cliq";
import { clockTime, cx, timeAgo } from "@/lib/utils";

const POLL_INTERVAL_MS = 3500;

/**
 * Cliq Group Lounges.
 *
 * A list of public interest lounges plus any private groups you're in, and a
 * room view with live-polled group messages, emoji reactions and media sharing.
 */
export function GroupChats({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { user, toast, apiError } = useCliq();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Group | null>(null);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [friends, setFriends] = useState<PublicUser[]>([]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [list, graph] = await Promise.all([api.listGroups(), api.getFriends()]);
        setGroups(list);
        setFriends(graph.friends);
      } catch (error) {
        apiError(error);
      } finally {
        setLoading(false);
      }
    },
    [apiError],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return groups;
    const q = query.toLowerCase();
    return groups.filter((g) => g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q));
  }, [groups, query]);

  if (open) {
    return (
      <GroupRoom
        group={open}
        onBack={() => setOpen(null)}
        onOpenProfile={onOpenProfile}
        onChanged={() => void load(true)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search group lounges..."
            className="h-10 w-full rounded-full border border-zinc-800 bg-zinc-950/60 pl-9 pr-3 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-indigo-600 px-4 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-500"
        >
          <Plus size={14} /> New
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-[#121317] p-3">
              <Skeleton className="h-11 w-11 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          title="No group lounges found"
          hint="Try another search, or start your own group with friends."
          actionLabel="Start a group"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setOpen(group)}
              className="cliq-rise flex w-full items-center gap-3 rounded-2xl border border-zinc-800/80 bg-[#121317] p-3 text-left transition hover:border-zinc-700"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-xl">
                {group.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-zinc-100">{group.name}</span>
                  {group.isPublic ? (
                    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
                      Lounge
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-[11px] text-zinc-500">{group.description || "Group chat"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-semibold text-zinc-400">{group.memberCount} members</p>
                {group.lastMessageAt ? (
                  <p className="text-[10px] text-zinc-600">{timeAgo(group.lastMessageAt)}</p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      {createOpen && user ? (
        <CreateGroupModal
          friends={friends}
          onClose={() => setCreateOpen(false)}
          onCreated={(group) => {
            setCreateOpen(false);
            setOpen(group);
            void load(true);
            toast(`Created "${group.name}" 🎉`, "success");
          }}
        />
      ) : null}
    </div>
  );
}

function CreateGroupModal({
  friends,
  onClose,
  onCreated,
}: {
  friends: PublicUser[];
  onClose: () => void;
  onCreated: (group: Group) => void;
}) {
  const { apiError } = useCliq();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("💬");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const ICONS = ["💬", "🎮", "🎵", "📚", "😂", "🌙", "⚡", "🔥", "🏀", "🎨"];

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const { group } = await api.createGroup({
        name: name.trim(),
        description: description.trim(),
        icon,
        memberIds: selected,
      });
      onCreated(group);
    } catch (error) {
      apiError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Start a Group Cliq" subtitle="Bring your friends into one room 💬">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-2xl">{icon}</span>
          <input
            value={name}
            autoFocus
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 text-sm font-semibold text-zinc-100 outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setIcon(option)}
              className={cx(
                "grid h-9 w-9 place-items-center rounded-xl text-lg transition",
                icon === option ? "bg-indigo-600/30 ring-1 ring-indigo-500" : "hover:bg-zinc-800",
              )}
            >
              {option}
            </button>
          ))}
        </div>

        <input
          value={description}
          maxLength={200}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this group about? (optional)"
          className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 text-sm text-zinc-100 outline-none focus:border-indigo-500"
        />

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Invite friends {selected.length > 0 ? `· ${selected.length}` : ""}
          </p>
          {friends.length === 0 ? (
            <p className="text-xs text-zinc-500">Add some Cliq friends first, then invite them here.</p>
          ) : (
            <div className="cliq-scroll max-h-56 space-y-1 overflow-y-auto">
              {friends.map((friend) => {
                const on = selected.includes(friend.id);
                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => toggle(friend.id)}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-xl p-2 text-left transition",
                      on ? "bg-[var(--accent-soft)]" : "hover:bg-zinc-800/60",
                    )}
                  >
                    <Avatar user={friend} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-zinc-200">{friend.displayName}</p>
                      <p className="truncate text-[11px] text-zinc-500">@{friend.username}</p>
                    </div>
                    {on ? <Check size={16} className="text-[var(--accent-2)]" /> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void create()}
          disabled={!name.trim() || busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-40"
        >
          {busy ? "Creating..." : <><Users size={16} /> Create group</>}
        </button>
      </div>
    </Modal>
  );
}

function GroupRoom({
  group,
  onBack,
  onOpenProfile,
  onChanged,
}: {
  group: Group;
  onBack: () => void;
  onOpenProfile: (id: string) => void;
  onChanged: () => void;
}) {
  const { user, toast, apiError } = useCliq();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (silent = false) => {
      try {
        const list = await api.listGroupMessages(group.id);
        setMessages(list);
        if (!silent) setTimeout(() => feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight }), 0);
      } catch (error) {
        if (!silent) apiError(error);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [group.id, apiError],
  );

  useEffect(() => {
    void load();
    // Public lounges: joining is implicit on first message, but show membership.
    if (group.isPublic) void api.joinGroup(group.id).catch(() => undefined);
  }, [load, group.id, group.isPublic]);

  useEffect(() => {
    const timer = setInterval(() => void load(true), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!draft.trim() || sending) return;
    setSending(true);
    const text = draft.trim();
    setDraft("");
    try {
      const { message } = await api.sendGroupMessage({ groupId: group.id, content: text });
      setMessages((prev) => [...prev, message]);
      onChanged();
    } catch (error) {
      setDraft(text);
      apiError(error);
    } finally {
      setSending(false);
    }
  }

  async function attach(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const result = await uploadMedia(file);
      const { message } = await api.sendGroupMessage({ groupId: group.id, mediaUrl: result.secureUrl });
      setMessages((prev) => [...prev, message]);
      onChanged();
    } catch (error) {
      apiError(error);
    } finally {
      setUploading(false);
    }
  }

  async function react(messageId: string, emoji: string) {
    setReactFor(null);
    try {
      const { message } = await api.reactToGroupMessage(messageId, emoji);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
    } catch (error) {
      apiError(error);
    }
  }

  return (
    <div className="flex h-[32rem] flex-col overflow-hidden rounded-3xl border border-zinc-800/80 bg-[#121317] lg:h-[34rem]">
      <header className="flex items-center gap-3 border-b border-zinc-800/80 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to groups"
          className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--accent-soft)] text-xl">{group.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-zinc-100">{group.name}</p>
          <p className="truncate text-[11px] text-zinc-500">
            {group.memberCount} members · {group.isPublic ? "Public lounge" : "Private group"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => toast("Invites arrive soon ✉️", "default")}
          className="grid h-9 w-9 place-items-center rounded-full border border-zinc-800 text-zinc-300 transition hover:border-[var(--accent)] hover:text-zinc-100"
          aria-label="Invite"
        >
          <Plus size={16} />
        </button>
      </header>

      <div ref={feedRef} className="cliq-scroll flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-xs text-zinc-500">
            <Spinner /> <span className="ml-2">Loading the room...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="text-3xl">{group.icon}</span>
            <p className="text-xs text-zinc-400">Be the first to say something in {group.name}.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const mine = msg.senderId === user?.id;
            return (
              <div key={msg.id} className={cx("flex items-end gap-2", mine && "flex-row-reverse")}>
                {!mine && msg.sender ? (
                  <button type="button" onClick={() => onOpenProfile(msg.senderId)} className="shrink-0">
                    <Avatar user={msg.sender} size={30} />
                  </button>
                ) : null}
                <div className={cx("max-w-[78%]", mine && "items-end")}>
                  {!mine && msg.sender ? (
                    <p className="mb-0.5 ml-1 text-[10px] font-semibold text-zinc-500">@{msg.sender.username}</p>
                  ) : null}
                  <div
                    className={cx(
                      "group relative rounded-2xl px-3 py-2 text-sm",
                      mine
                        ? "bg-indigo-600 text-white"
                        : "border border-zinc-800/80 bg-zinc-950/70 text-zinc-200",
                    )}
                  >
                    {msg.mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={msg.mediaUrl} alt="" className="mb-1.5 max-h-56 rounded-xl object-cover" />
                    ) : null}
                    {msg.content ? <p className="whitespace-pre-wrap break-words">{msg.content}</p> : null}
                    <span className={cx("mt-0.5 block text-[9px]", mine ? "text-white/60" : "text-zinc-600")}>
                      {clockTime(msg.createdAt)}
                    </span>

                    <button
                      type="button"
                      onClick={() => setReactFor((prev) => (prev === msg.id ? null : msg.id))}
                      aria-label="React"
                      className={cx(
                        "absolute top-1 opacity-0 transition group-hover:opacity-100",
                        mine ? "left-1" : "right-1",
                      )}
                    >
                      <Smile size={13} className="text-white/70" />
                    </button>

                    {reactFor === msg.id ? (
                      <div className={cx("absolute -top-9 z-10 flex gap-0.5 rounded-full border border-zinc-700 bg-zinc-900 p-1 shadow-xl", mine ? "right-0" : "left-0")}>
                        {MESSAGE_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => void react(msg.id, emoji)}
                            className="grid h-7 w-7 place-items-center rounded-full text-sm transition hover:bg-zinc-800"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {msg.reactions.length > 0 ? (
                    <div className={cx("mt-1 flex flex-wrap gap-1", mine && "justify-end")}>
                      {msg.reactions.map((r) => (
                        <button
                          key={r.emoji}
                          type="button"
                          onClick={() => void react(msg.id, r.emoji)}
                          className={cx(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition",
                            r.mine
                              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-zinc-100"
                              : "border-zinc-800 text-zinc-400 hover:border-zinc-700",
                          )}
                        >
                          {r.emoji} {r.count}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showEmoji ? (
        <div className="flex flex-wrap gap-1 border-t border-zinc-800/80 px-3 py-2">
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

      <div className="flex items-center gap-2 border-t border-zinc-800/80 px-3 py-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void attach(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Attach photo"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
        >
          {uploading ? <Spinner className="h-4 w-4" /> : <ImageIcon size={18} />}
        </button>
        <button
          type="button"
          onClick={() => setShowEmoji((v) => !v)}
          aria-label="Emoji"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Smile size={18} />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={`Message ${group.name}...`}
          className="min-w-0 flex-1 rounded-full border border-zinc-800 bg-zinc-950/60 px-4 py-2 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!draft.trim() || sending}
          aria-label="Send"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-500 disabled:opacity-40"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
