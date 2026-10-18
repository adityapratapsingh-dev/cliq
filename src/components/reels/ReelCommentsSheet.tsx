"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar } from "@/components/ui/Primitives";
import { CommentThread } from "@/components/ui/FeedBits";
import { useComments } from "@/components/tabs/useFeed";
import type { Post } from "@/types/cliq";

/**
 * Glassmorphic bottom sheet covering the lower half of the reel.
 *
 * It deliberately does NOT pause the video — you can keep watching while
 * reading and posting comments, which is the whole point of a reels UI.
 */
export function ReelCommentsSheet({
  post,
  open,
  onClose,
}: {
  post: Post;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useCliq();
  const { comments, loading, add } = useComments(post.id, open);
  const [draft, setDraft] = useState("");

  if (!open) return null;

  async function submit() {
    if (!draft.trim()) return;
    const text = draft;
    setDraft("");
    await add(text);
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 h-[60%]" data-testid="reel-comments-sheet">
      {/* Click-away layer over the top half so the video stays visible */}
      <button
        type="button"
        aria-label="Close comments"
        onClick={onClose}
        className="cliq-sheet-fade absolute -top-[66%] left-0 h-[66%] w-full cursor-default"
      />

      <div className="cliq-sheet-up flex h-full flex-col overflow-hidden rounded-t-3xl border-t border-zinc-700/50 bg-[#121216]">
        <div className="flex items-center justify-between border-b border-white/10/60 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-zinc-50">{post.commentCount} comments</p>
            <p className="text-[11px] text-zinc-500">On @{post.author?.username ?? "unknown"}&apos;s reel</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full border border-zinc-700/60 text-zinc-400 transition hover:text-zinc-100"
          >
            <X size={15} />
          </button>
        </div>

        <div className="cliq-scroll flex-1 overflow-y-auto px-4 py-3">
          <CommentThread
            comments={comments}
            loading={loading}
            onReply={(parentId, text) => add(text, parentId)}
            canInteract={Boolean(user)}
            toxicFilter
          />
        </div>

        <div className="flex items-center gap-2 border-t border-white/10/60 px-3 py-3">
          {user ? <Avatar user={user} size={32} /> : null}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="Add a comment on Cliq..."
            className="min-w-0 flex-1 rounded-full border border-zinc-700/60 bg-zinc-950/70 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            aria-label="Post comment"
            onClick={() => void submit()}
            disabled={!draft.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-indigo-600 text-white transition disabled:opacity-40"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
