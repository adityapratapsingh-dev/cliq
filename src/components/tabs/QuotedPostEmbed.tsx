"use client";

import { Film, Image as ImageIcon, MessageSquare } from "lucide-react";
import { HashtagText } from "@/components/ui/FeedBits";
import type { QuotedPost } from "@/types/cliq";
import { timeAgo } from "@/lib/utils";

/** Compact embedded preview of the post a quote-repost is replying to. */
export function QuotedPostEmbed({ post }: { post: QuotedPost }) {
  const Icon = post.type === "video" ? Film : post.type === "photo" ? ImageIcon : MessageSquare;

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/50">
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--accent-soft)] text-[var(--accent-2)]">
          <Icon size={12} />
        </span>
        <span className="truncate text-[11px] font-semibold text-zinc-300">
          @{post.author?.username ?? "unknown"}
        </span>
        <span className="ml-auto shrink-0 text-[10px] text-zinc-600">{timeAgo(post.createdAt)}</span>
      </div>

      {post.mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.mediaUrl} alt="" className="mt-2 max-h-64 w-full object-cover" />
      ) : null}

      {post.content ? (
        <p className="px-3 pb-3 pt-2 text-xs leading-relaxed text-zinc-400">
          <HashtagText text={post.content} />
        </p>
      ) : null}
    </div>
  );
}
