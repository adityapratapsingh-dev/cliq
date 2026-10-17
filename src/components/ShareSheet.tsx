"use client";

import { useState } from "react";
import useSWR from "swr";
import { Check, Copy, Link2, Search, Send, Sparkles } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { api, swrFetcher } from "@/lib/api-client";
import { Avatar, Modal, Spinner } from "@/components/ui/Primitives";
import type { Post } from "@/types/cliq";
import { cx, timeAgo } from "@/lib/utils";

/** Build the link + preview text that gets sent into a DM. */
export function sharePayload(post: Post, origin: string) {
  const url = `${origin}/?post=${encodeURIComponent(post.id)}`;
  const kind = post.type === "video" ? "Reel" : post.type === "photo" ? "Photo" : "Chat post";
  const snippet = post.content.length > 90 ? `${post.content.slice(0, 90)}…` : post.content;
  const preview = `@${post.author?.username ?? "someone"} shared a ${kind}${snippet ? `: "${snippet}"` : ""}`;
  return { url, preview, kind };
}

/**
 * Share sheet.
 *
 * Sends the post into a Direct Chat as a message containing the link plus a
 * text preview, or copies the link. Works for reels, photos and chat posts.
 */
export function ShareSheet({
  open,
  onClose,
  post,
  onShared,
}: {
  open: boolean;
  onClose: () => void;
  post: Post | null;
  onShared?: () => void;
}) {
  const { toast, apiError } = useCliq();
  const [query, setQuery] = useState("");
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useSWR<{ friends: { id: string; username: string; displayName: string; avatarUrl: string | null }[] }>(
    open ? "/api/friends" : null,
    swrFetcher,
    { revalidateOnFocus: false },
  );

  const friends = (data?.friends ?? []).filter((f) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().replace(/^@/, "");
    return f.username.toLowerCase().includes(q) || f.displayName.toLowerCase().includes(q);
  });

  function origin() {
    return typeof window !== "undefined" ? window.location.origin : "https://oncliq.vercel.app";
  }

  async function sendTo(friendId: string, username: string) {
    if (!post || sendingTo) return;
    setSendingTo(friendId);
    try {
      const { url, preview } = sharePayload(post, origin());
      await api.sendMessage({
        receiverId: friendId,
        content: `${preview}\n${url}`,
        // Attach the media so the DM renders the thumbnail too.
        mediaUrl: post.mediaUrl,
      });
      setSentTo((prev) => [...prev, friendId]);
      toast(`Sent to @${username} ✅`, "success");
      onShared?.();
    } catch (error) {
      apiError(error);
    } finally {
      setSendingTo(null);
    }
  }

  async function copyLink() {
    if (!post) return;
    const { url } = sharePayload(post, origin());
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copied to clipboard 🔗", "success");
    } catch {
      toast("Couldn't access the clipboard — long-press the link to copy.", "danger");
    }
  }

  if (!post) return null;
  const { url, kind } = sharePayload(post, origin());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share"
      subtitle={`Send this ${kind.toLowerCase()} to a Cliq friend`}
      maxWidth="max-w-md"
    >
      <div className="space-y-3">
        {/* preview of what will be sent */}
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 p-3">
          {post.mediaUrl && post.type !== "chat" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.mediaUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          ) : (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-2)]">
              <Sparkles size={18} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-zinc-100">
              @{post.author?.username ?? "unknown"}
            </p>
            <p className="line-clamp-2 text-[11px] text-zinc-500">{post.content || kind}</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">{timeAgo(post.createdAt)}</p>
          </div>
        </div>

        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends..."
            className="h-10 w-full rounded-full border border-zinc-800 bg-zinc-950/60 pl-9 pr-3 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="cliq-no-bar max-h-64 space-y-1 overflow-y-auto">
          {isLoading ? (
            <p className="flex items-center gap-2 px-2 py-6 text-xs text-zinc-500">
              <Spinner /> Loading friends...
            </p>
          ) : friends.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-zinc-500">
              No friends yet — send a Cliq Up to start sharing.
            </p>
          ) : (
            friends.map((friend) => {
              const sent = sentTo.includes(friend.id);
              return (
                <div key={friend.id} className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-zinc-800/50">
                  <Avatar user={friend} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-zinc-100">{friend.displayName}</p>
                    <p className="truncate text-[11px] text-zinc-500">@{friend.username}</p>
                  </div>
                  <button
                    type="button"
                    disabled={sendingTo === friend.id || sent}
                    onClick={() => void sendTo(friend.id, friend.username)}
                    className={cx(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-60",
                      sent
                        ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : "bg-[var(--accent-grad)] text-white hover:brightness-110",
                    )}
                  >
                    {sent ? (
                      <>
                        <Check size={12} /> Sent
                      </>
                    ) : sendingTo === friend.id ? (
                      <Spinner className="h-3 w-3" />
                    ) : (
                      <>
                        <Send size={12} /> Send
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-1.5 border-t border-zinc-800/80 pt-3">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="flex w-full items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/50 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:border-[var(--accent)] hover:bg-zinc-900"
          >
            {copied ? <Check size={16} className="text-emerald-400" /> : <Link2 size={16} />}
            {copied ? "Link copied" : "Copy Link"}
          </button>
          <p className="truncate px-1 text-[10px] text-zinc-600">{url}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-semibold text-zinc-500 transition hover:text-zinc-200"
          >
            <Copy size={13} /> Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
