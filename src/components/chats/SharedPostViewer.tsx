"use client";

import useSWR from "swr";
import { Heart, MessageCircle, Play, X } from "lucide-react";
import { swrFetcher } from "@/lib/api-client";
import { Avatar, Spinner } from "@/components/ui/Primitives";
import type { Post } from "@/types/cliq";
import { formatCount, timeAgo } from "@/lib/utils";

/**
 * Full-screen viewer for a post shared into a chat.
 *
 * Opened by the "View Post" action on an embedded card, so a tapped share never
 * dumps the user out of the conversation.
 */
export function SharedPostViewer({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { data, isLoading } = useSWR<{ post: Post }>(
    [`/api/posts/${encodeURIComponent(postId)}`, undefined],
    swrFetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const post = data?.post;

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black p-4">
      <button type="button" aria-label="Close post" onClick={onClose} className="absolute inset-0 cursor-default" />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-[#262626] bg-[#121317]">
        <div className="flex items-center gap-3 border-b border-[#262626] px-4 py-3">
          {post?.author ? <Avatar user={post.author} size={38} /> : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-zinc-100">{post?.author?.displayName ?? "Post"}</p>
            <p className="truncate text-[11px] text-zinc-500">
              @{post?.author?.username ?? "unknown"}
              {post ? ` · ${timeAgo(post.createdAt)}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full border border-[#262626] text-zinc-400 transition hover:text-zinc-100"
          >
            <X size={16} />
          </button>
        </div>

        {isLoading && !post ? (
          <p className="flex items-center justify-center gap-2 py-16 text-xs text-zinc-500">
            <Spinner /> Loading post...
          </p>
        ) : !post ? (
          <p className="py-16 text-center text-xs text-zinc-500">This post is no longer available.</p>
        ) : (
          <>
            {post.mediaUrl && post.type !== "chat" ? (
              <div className="relative max-h-[60vh] w-full bg-black">
                {post.type === "video" ? (
                  <video src={post.mediaUrl} className="max-h-[60vh] w-full object-contain" controls autoPlay loop />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.mediaUrl} alt="" className="max-h-[60vh] w-full object-contain"  loading="lazy" decoding="async" />
                )}
                {post.type === "video" ? (
                  <span className="pointer-events-none absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white">
                    <Play size={14} className="ml-0.5" fill="currentColor" />
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="px-4 py-3">
              {post.content ? <p className="text-sm leading-relaxed text-zinc-200">{post.content}</p> : null}
              <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-zinc-400">
                <span className="inline-flex items-center gap-1">
                  <Heart size={13} /> {formatCount(post.likesCount)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle size={13} /> {formatCount(post.commentCount)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
