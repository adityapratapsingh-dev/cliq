"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Heart, MessageCircle, Send, ThumbsDown } from "lucide-react";
import type { Comment, PublicUser } from "@/types/cliq";
import { Avatar, IconButton, Spinner } from "@/components/ui/Primitives";
import { cx, formatCount, censor, timeAgo } from "@/lib/utils";

export function HashtagText({ text }: { text: string }) {
  const parts = text.split(/(#[\p{L}\p{N}_]+)/gu);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith("#") ? (
          <span key={i} className="cursor-pointer font-medium text-[#4f46e5] hover:underline">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

export function CommentThread({
  comments,
  loading,
  onReply,
  canInteract,
  toxicFilter,
}: {
  comments: Comment[];
  loading?: boolean;
  onReply: (parentId: string, text: string) => Promise<void>;
  canInteract: boolean;
  toxicFilter: boolean;
}) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  if (loading) {
    return (
      <p className="flex items-center gap-2 px-1 py-3 text-xs text-zinc-500">
        <Spinner /> Loading comments...
      </p>
    );
  }

  if (comments.length === 0) {
    return <p className="px-1 py-3 text-xs text-zinc-500">No comments yet. Start the conversation.</p>;
  }

  async function submitReply(parentId: string) {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      await onReply(parentId, replyText);
      setReplyText("");
      setReplyTo(null);
    } finally {
      setSending(false);
    }
  }

  const renderComment = (comment: Comment, depth = 0): ReactNode => (
    <div key={comment.id} className={cx("space-y-2", depth > 0 && "ml-6 border-l border-white/10 pl-3")}>
      <div className="flex items-start gap-2.5">
        {comment.author ? (
          <Avatar user={comment.author} size={depth > 0 ? 26 : 30} />
        ) : (
          <span className="h-7 w-7 rounded-full bg-zinc-800" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-xs">
            <span className="font-semibold text-zinc-200">{comment.author?.displayName ?? "Cliq User"}</span>
            <span className="text-zinc-500">@{comment.author?.username ?? "unknown"}</span>
            <span className="text-zinc-600">· {timeAgo(comment.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-sm text-zinc-300">
            <HashtagText text={censor(comment.content, toxicFilter)} />
          </p>
          {canInteract ? (
            <div className="mt-0.5">
              <IconButton
                icon={<MessageCircle size={13} />}
                label="Reply"
                onClick={() => setReplyTo((prev) => (prev === comment.id ? null : comment.id))}
                title="Reply"
              />
            </div>
          ) : null}
          {replyTo === comment.id ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                value={replyText}
                autoFocus
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitReply(comment.id);
                }}
                placeholder="Write a reply..."
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#121216] px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-zinc-600"
              />
              <button
                type="button"
                onClick={() => void submitReply(comment.id)}
                disabled={sending || !replyText.trim()}
                className="rounded-lg bg-[#4f46e5] p-1.5 text-white disabled:opacity-40"
                aria-label="Send reply"
              >
                {sending ? <Spinner /> : <Send size={13} />}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {comment.replies.map((r) => renderComment(r, depth + 1))}
    </div>
  );

  return <div className="space-y-3.5">{comments.map((c) => renderComment(c))}</div>;
}

/** Upgrade / downgrade pill: up arrow, net score, down arrow. */
export function VoteBar({
  score,
  vote,
  onUp,
  onDown,
  disabled,
  size = "md",
}: {
  score: number;
  vote: "up" | "down" | null;
  onUp: () => void;
  onDown: () => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-white/10 bg-[#121216]">
      <button
        type="button"
        onClick={onUp}
        disabled={disabled}
        aria-label="Upgrade"
        className={cx(
          "grid place-items-center rounded-full p-1.5 transition disabled:opacity-40",
          vote === "up" ? "text-[#10b981]" : "text-zinc-500 hover:text-[#10b981]",
        )}
      >
        <ArrowUp size={size === "sm" ? 14 : 16} className={vote === "up" ? "fill-current" : ""} />
      </button>
      <span
        className={cx(
          "min-w-6 text-center font-semibold tabular-nums",
          size === "sm" ? "text-xs" : "text-sm",
          vote === "up" ? "text-[#10b981]" : vote === "down" ? "text-[#f59e0b]" : "text-zinc-300",
        )}
      >
        {formatCount(score)}
      </span>
      <button
        type="button"
        onClick={onDown}
        disabled={disabled}
        aria-label="Downgrade"
        className={cx(
          "grid place-items-center rounded-full p-1.5 transition disabled:opacity-40",
          vote === "down" ? "text-[#f59e0b]" : "text-zinc-500 hover:text-[#f59e0b]",
        )}
      >
        <ArrowDown size={size === "sm" ? 14 : 16} className={vote === "down" ? "fill-current" : ""} />
      </button>
    </div>
  );
}

export function LikePair({
  likes,
  liked,
  dislikes,
  disliked,
  hideDislikes,
  onLike,
  onDislike,
  disabled,
}: {
  likes: number;
  liked: boolean;
  dislikes: number;
  disliked: boolean;
  hideDislikes?: boolean;
  onLike: () => void;
  onDislike: () => void;
  disabled?: boolean;
}) {
  return (
    <>
      <IconButton
        icon={<Heart size={22} className={liked ? "fill-current" : ""} />}
        count={formatCount(likes)}
        active={liked}
        activeColor="#ff3040"
        onClick={onLike}
        disabled={disabled}
        title="Like"
      />
      <IconButton
        icon={<ThumbsDown size={22} className={disliked ? "fill-current" : ""} />}
        count={hideDislikes ? "—" : formatCount(dislikes)}
        active={disliked}
        activeColor="#f59e0b"
        onClick={onDislike}
        disabled={disabled}
        title="Dislike"
      />
    </>
  );
}

export function AuthorLine({ user, meta }: { user: PublicUser | null; meta: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm font-semibold text-zinc-100">{user?.displayName ?? "Cliq User"}</span>
        <span className="truncate text-xs text-zinc-500">@{user?.username ?? "unknown"}</span>
      </div>
      <p className="truncate text-xs text-zinc-500">{meta}</p>
    </div>
  );
}
