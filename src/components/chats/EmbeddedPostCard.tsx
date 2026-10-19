"use client";

import useSWR from "swr";
import { Heart, MessageCircle, Play } from "lucide-react";
import { swrFetcher } from "@/lib/api-client";
import { Avatar, Spinner } from "@/components/ui/Primitives";
import type { Post } from "@/types/cliq";
import { cx, formatCount } from "@/lib/utils";

/**
 * Instagram/Discord-style embedded preview of a shared post.
 *
 * Rendered inside a chat bubble instead of a raw URL. Resolves the post by id
 * from `/api/posts/[id]` and caches it, so scrolling a thread does not refetch.
 */
export function EmbeddedPostCard({
  postId,
  mine,
  onView,
}: {
  postId: string;
  /** Sent messages get a lighter treatment so the card reads on the bubble. */
  mine: boolean;
  onView?: (postId: string) => void;
}) {
  const { data, isLoading, error } = useSWR<{ post: Post }>(
    [`/api/posts/${encodeURIComponent(postId)}`, undefined],
    swrFetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const post = data?.post;

  if (isLoading) {
    return (
      <span className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-[11px] text-white/70">
        <Spinner className="h-3 w-3" /> Loading shared post...
      </span>
    );
  }

  if (error || !post) {
    return (
      <span className="block rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] text-white/60">
        This post is no longer available.
      </span>
    );
  }

  const label = post.type === "video" ? "Reel" : post.type === "photo" ? "Photo" : "Post";

  return (
    <button
      type="button"
      data-testid="embedded-post-card"
      onClick={() => onView?.(post.id)}
      className={cx(
        "block w-full max-w-[280px] overflow-hidden rounded-2xl border border-white/10 text-left shadow-lg transition hover:border-white/25",
        mine ? "bg-black/25" : "bg-black/40",
      )}
    >
      {/* Author row */}
      <span className="flex items-center gap-2 px-3 py-2">
        {post.author ? <Avatar user={post.author} size={24} /> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-bold text-white">
            @{post.author?.username ?? "unknown"}
          </span>
          <span className="block text-[9px] font-semibold uppercase tracking-wider text-white/50">{label}</span>
        </span>
      </span>

      {/* Media or quote */}
      {post.mediaUrl && post.type !== "chat" ? (
        <span className="relative block h-36 w-full overflow-hidden bg-black">
          {post.type === "video" ? (
            <>
              <video src={post.mediaUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
              <span className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white backdrop-blur">
                  <Play size={14} className="ml-0.5" fill="currentColor" />
                </span>
              </span>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.mediaUrl} alt="" className="h-full w-full object-cover" />
          )}
        </span>
      ) : (
        <span className="block border-y border-white/10 bg-black/20 px-3 py-3">
          <span className="line-clamp-3 text-[11px] leading-relaxed text-white/80">
            {post.content || "No caption"}
          </span>
        </span>
      )}

      {/* Caption + engagement */}
      {post.mediaUrl && post.content ? (
        <span className="block px-3 pt-2">
          <span className="line-clamp-2 text-[11px] leading-snug text-white/80">{post.content}</span>
        </span>
      ) : null}

      <span className="flex items-center justify-between px-3 py-2">
        <span className="flex items-center gap-3 text-[10px] font-semibold text-white/60">
          <span className="inline-flex items-center gap-1">
            <Heart size={11} /> {formatCount(post.likesCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={11} /> {formatCount(post.commentCount)}
          </span>
        </span>
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold text-white">View Post</span>
      </span>
    </button>
  );
}
