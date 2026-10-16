"use client";

import { useState, type ReactNode } from "react";
import { Heart, MessageCircle, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import type { CliqUser, Comment } from "@/types/cliq";
import { Avatar, IconStat } from "@/components/ui/Primitives";
import { cx, formatCount, timeAgo } from "@/lib/utils";

export function HashtagText({ text }: { text: string }) {
  const parts = text.split(/(#[\p{L}\p{N}_]+)/gu);
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith("#") ? (
          <span key={i} className="cursor-pointer font-semibold text-[var(--accent-2)] hover:underline">
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
  userMap,
  onLike,
  onReply,
  compact,
}: {
  comments: Comment[];
  userMap: Record<string, CliqUser>;
  onLike: (commentId: string) => void;
  onReply?: (commentId: string, text: string) => void;
  compact?: boolean;
}) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  if (comments.length === 0) {
    return (
      <p className="px-1 py-3 text-xs text-zinc-500">
        No comments yet — start the conversation on Cliq 💬
      </p>
    );
  }

  const renderComment = (comment: Comment, depth = 0): ReactNode => {
    const author = userMap[comment.authorId] ?? {
      id: comment.authorId,
      name: "Cliq User",
      handle: "cliquser",
      avatar: ["#8b5cf6", "#22d3ee"] as [string, string],
      age: 16,
      vibe: "",
      bio: "",
      interests: [],
      online: false,
    };
    return (
      <div key={comment.id} className={cx("space-y-2", depth > 0 && "ml-6 border-l border-zinc-800 pl-3")}>
        <div className="flex items-start gap-2.5">
          <Avatar user={author} size={compact ? 28 : 32} showOnline={false} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 text-xs">
              <span className="font-semibold text-zinc-200">{author.name}</span>
              <span className="text-zinc-500">@{author.handle}</span>
              <span className="text-zinc-600">· {timeAgo(comment.createdAt)}</span>
            </div>
            <p className="mt-0.5 text-sm text-zinc-300">
              <HashtagText text={comment.text} />
            </p>
            <div className="mt-0.5 flex items-center gap-1">
              <IconStat
                icon={<Heart size={13} className={comment.liked ? "fill-current" : ""} />}
                count={comment.likes}
                active={comment.liked}
                activeColor="#fb7185"
                onClick={() => onLike(comment.id)}
                title="Like comment"
              />
              {onReply ? (
                <IconStat
                  icon={<MessageCircle size={13} />}
                  label="Reply"
                  onClick={() => setReplyTo((prev) => (prev === comment.id ? null : comment.id))}
                  title="Reply"
                />
              ) : null}
            </div>
            {replyTo === comment.id && onReply ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={replyText}
                  autoFocus
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && replyText.trim()) {
                      onReply(comment.id, replyText);
                      setReplyText("");
                      setReplyTo(null);
                    }
                  }}
                  placeholder="Write a reply..."
                  className="min-w-0 flex-1 rounded-full border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (replyText.trim()) {
                      onReply(comment.id, replyText);
                      setReplyText("");
                      setReplyTo(null);
                    }
                  }}
                  className="rounded-full bg-[var(--accent-grad)] p-1.5 text-white"
                  aria-label="Send reply"
                >
                  <Send size={13} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {comment.replies.map((r) => renderComment(r, depth + 1))}
      </div>
    );
  };

  return <div className="space-y-3.5">{comments.map((c) => renderComment(c))}</div>;
}

export function VoteBar({
  score,
  vote,
  onUp,
  onDown,
  size = "md",
}: {
  score: number;
  vote: "up" | "down" | null;
  onUp: () => void;
  onDown: () => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs gap-1" : "px-3 py-1.5 text-sm gap-1.5";
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-zinc-800/80 bg-zinc-950/60 p-0.5">
      <button
        type="button"
        onClick={onUp}
        className={cx(
          "inline-flex items-center rounded-full font-bold transition",
          pad,
          vote === "up"
            ? "bg-emerald-500/20 text-emerald-300"
            : "text-zinc-400 hover:bg-zinc-800 hover:text-emerald-300",
        )}
      >
        <ThumbsUp size={size === "sm" ? 12 : 14} className={vote === "up" ? "fill-current" : ""} />
        {size === "md" ? "Upgrade" : null}
      </button>
      <span
        className={cx(
          "min-w-9 text-center tabular-nums font-bold",
          size === "sm" ? "text-xs" : "text-sm",
          score > 0 ? "text-emerald-300" : score < 0 ? "text-rose-300" : "text-zinc-400",
        )}
      >
        {formatCount(score)}
      </span>
      <button
        type="button"
        onClick={onDown}
        className={cx(
          "inline-flex items-center rounded-full font-bold transition",
          pad,
          vote === "down"
            ? "bg-rose-500/20 text-rose-300"
            : "text-zinc-400 hover:bg-zinc-800 hover:text-rose-300",
        )}
      >
        <ThumbsDown size={size === "sm" ? 12 : 14} className={vote === "down" ? "fill-current" : ""} />
        {size === "md" ? "Downgrade" : null}
      </button>
    </div>
  );
}
