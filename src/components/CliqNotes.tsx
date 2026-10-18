"use client";

import { useState } from "react";
import useSWR from "swr";
import { Check, Plus } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { api, swrFetcher } from "@/lib/api-client";
import { Avatar, Modal } from "@/components/ui/Primitives";
import { NOTE_MAX_LENGTH, type PublicUser } from "@/types/cliq";
import { cx } from "@/lib/utils";

const NOTE_EMOJI = ["🎮", "📚", "🎵", "🏀", "🎨", "💻", "😴", "🔥", "✨", "☕"];

/**
 * Instagram-style Cliq Notes bar.
 *
 * Your own avatar opens a composer; a friend's note opens a quick reply that
 * drops straight into their DM. Notes expire after 24h (enforced server-side).
 */
export function CliqNotes({
  onOpenProfile,
  bare = false,
  inline = false,
}: {
  onOpenProfile: (id: string) => void;
  /** When true, renders without the card chrome (used inside a bordered section). */
  bare?: boolean;
  /** When true, renders as a bare horizontal row (used inside the compact tray). */
  inline?: boolean;
}) {
  const { user, refreshUser, toast, apiError } = useCliq();
  const [composerOpen, setComposerOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<PublicUser | null>(null);
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState("✨");
  const [busy, setBusy] = useState(false);

  const { data, mutate } = useSWR<{ users: PublicUser[] }>(user ? ["/api/users", undefined] : null, swrFetcher, {
    revalidateOnFocus: false,
  });

  // Only people with a live note appear in the bar.
  const withNotes = (data?.users ?? []).filter((u) => u.note?.text);
  const myNote = user?.settings.note ?? null;

  async function saveNote() {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await api.setNote(text.trim(), emoji);
      await refreshUser();
      await mutate();
   toast("Note dropped for 24 hours","success");
      setComposerOpen(false);
      setText("");
    } catch (error) {
      apiError(error);
    } finally {
      setBusy(false);
    }
  }

  async function clearNote() {
    setBusy(true);
    try {
      await api.clearNote();
      await refreshUser();
      await mutate();
   toast("Note removed","default");
      setComposerOpen(false);
    } catch (error) {
      apiError(error);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div
      className={
        inline ? "no-scrollbar flex shrink-0 items-center gap-3 overflow-x-auto" : bare ? "" : "mb-3 rounded-2xl border border-white/10 bg-[#121216]/90 px-3 py-3"
      }
    >
      <div className="no-scrollbar flex gap-3 overflow-x-auto">
        {/* Your own note */}
        <button
          type="button"
          onClick={() => {
            setText(myNote?.text ?? "");
            setEmoji(myNote?.emoji || "✨");
            setComposerOpen(true);
          }}
          className="flex w-[68px] shrink-0 flex-col items-center gap-1.5"
        >
          <span className="relative">
            <Avatar user={user} size={54} />
            {!myNote ? (
              <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-[#121317] bg-indigo-600 text-white">
                <Plus size={11} strokeWidth={3} />
              </span>
            ) : (
              <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-[#121317] bg-emerald-500 text-white">
                <Check size={11} strokeWidth={3} />
              </span>
            )}
          </span>
          <span className="truncate text-[10px] font-semibold text-zinc-400">
            {myNote ? "Your note" : "Drop a Note"}
          </span>
        </button>

        {/* Friends' notes */}
        {withNotes.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => setReplyTo(person)}
            className="flex w-[68px] shrink-0 flex-col items-center gap-1.5"
          >
            <span className="relative">
              {/* Speech bubble above the avatar */}
              <span className="absolute -top-2 left-1/2 z-10 max-w-[92px] -translate-x-1/2 whitespace-nowrap rounded-xl border border-zinc-700/70 bg-zinc-800 px-2 py-1 text-[9px] font-semibold text-zinc-100 shadow-lg">
                {person.note?.emoji} {person.note?.text}
              </span>
              <span className="mt-5 block rounded-full ring-2 ring-indigo-500/70 ring-offset-2 ring-offset-[#121317]">
                <Avatar user={person} size={50} />
              </span>
            </span>
            <span className="truncate text-[10px] font-semibold text-zinc-400">{person.displayName.split(" ")[0]}</span>
          </button>
        ))}

        {withNotes.length === 0 ? (
          <span className="flex items-center px-2 text-[11px] text-zinc-500">
            No notes yet — be the first to drop one.
          </span>
        ) : null}
      </div>

      {/* Composer */}
      <Modal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        title="Drop a Cliq Note"
    subtitle="Shows for 24 hours at the top of Chats and Chat Posts"
        maxWidth="max-w-sm"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {NOTE_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={cx(
                  "grid h-9 w-9 place-items-center rounded-xl text-lg transition",
                  emoji === e ? "bg-indigo-600/20 ring-1 ring-indigo-500" : "hover:bg-zinc-800",
                )}
              >
                {e}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX_LENGTH))}
              autoFocus
              placeholder="🎮 Grinding ranked"
              className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2.5 pr-14 text-sm text-zinc-100 outline-none focus:border-indigo-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-zinc-500">
              {text.length}/{NOTE_MAX_LENGTH}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void saveNote()}
              disabled={!text.trim() || busy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-40"
            >
              {busy ? "Saving..." : "Share Note"}
            </button>
            {myNote ? (
              <button
                type="button"
                onClick={() => void clearNote()}
                disabled={busy}
                className="rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-zinc-400 transition hover:text-rose-300"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </Modal>

      {/* Quick reply to a friend's note */}
      <Modal
        open={Boolean(replyTo)}
        onClose={() => setReplyTo(null)}
        title={replyTo ? `Reply to @${replyTo.username}` : ""}
    subtitle={replyTo?.note ?`${replyTo.note.emoji} ${replyTo.note.text}` : undefined}
        maxWidth="max-w-sm"
      >
        <div className="space-y-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 200))}
            autoFocus
            placeholder="Send a quick reply..."
            className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-indigo-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!text.trim()}
              onClick={async () => {
                if (!replyTo || !text.trim()) return;
                try {
                  await api.sendMessage({ receiverId: replyTo.id, content: text.trim() });
         toast(`Reply sent to @${replyTo.username}`,"success");
                  setText("");
                  setReplyTo(null);
                } catch (error) {
                  apiError(error);
                }
              }}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-40"
            >
              Send Reply
            </button>
            <button
              type="button"
              onClick={() => {
                if (replyTo) onOpenProfile(replyTo.id);
                setReplyTo(null);
              }}
              className="rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-indigo-500"
            >
              View Profile
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
