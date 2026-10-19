"use client";

import { useRef, useState } from "react";
import {
  Bookmark,
  EyeOff,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Send,
  ThumbsDown,
  Trash2,
  X,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar, EmptyState, Modal, SkeletonCard } from "@/components/ui/Primitives";
import { CommentThread, HashtagText } from "@/components/ui/FeedBits";
import { ShareSheet } from "@/components/ShareSheet";
import { matchesSearch, useComments, useFeed } from "@/components/tabs/useFeed";
import { usePostActions } from "@/components/tabs/usePostActions";
import type { Post } from "@/types/cliq";
import { cx, formatCount, timeAgo } from "@/lib/utils";

export function PhotosTab({ search, onOpenProfile }: { search: string; onOpenProfile: (id: string) => void }) {
  const { posts, loading } = useFeed("photo");
  const { setCreateOpen } = useCliq();
  const [draft, setDraft] = useState("");
  const [commentTarget, setCommentTarget] = useState<Post | null>(null);
  const [hidden] = useState<string[]>([]);
  const [lightboxPost, setLightboxPost] = useState<Post | null>(null);

  const visible = posts.filter((p) => !hidden.includes(p.id) && matchesSearch(p, search));

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[620px]">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[620px]">
        <EmptyState
          icon={<ImageIcon size={26} strokeWidth={1.75} />}
          title={search ? "No photos match that search" : "No photos yet"}
          hint={search ? "Try a different search." : "Be the first to post a photo."}
          actionLabel={search ? undefined : "Create a post"}
          onAction={search ? undefined : () => setCreateOpen(true)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[620px] px-2 py-4">
      {/*
        Masonry via CSS columns: each tile keeps its natural aspect ratio, which
        reads as a bento grid without needing measured heights in JS.
      */}
      <div className="columns-2 gap-2 sm:columns-3">
        {visible.map((post) => (
          <BentoTile
            key={post.id}
            post={post}
            onOpen={() => setLightboxPost(post)}
            onOpenProfile={onOpenProfile}
          />
        ))}
      </div>

      {lightboxPost ? (
        <PhotoLightbox
          post={lightboxPost}
          onClose={() => setLightboxPost(null)}
          onComment={() => {
            setCommentTarget(lightboxPost);
            setLightboxPost(null);
          }}
          onOpenProfile={onOpenProfile}
        />
      ) : null}

      <CommentModal post={commentTarget} onClose={() => setCommentTarget(null)} draft={draft} setDraft={setDraft} />
    </div>
  );
}

export function PhotoCard({
  post,
  onComment,
  onHide,
  onOpenProfile,
}: {
  post: Post;
  onComment: () => void;
  onHide: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const { toast, savedIds, toggleSaved, user: me } = useCliq();
  const { react, remove } = usePostActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const lastTap = useRef(0);
  const burstId = useRef(0);

  const liked = post.myReaction === "like";
  const disliked = post.myReaction === "dislike";
  const saved = savedIds.includes(post.id);

  return (
    <article className="border-b border-white/10 pb-5 mb-5">
      <header className="flex items-center justify-between py-3">
        <button
          type="button"
          onClick={() => post.author && onOpenProfile(post.author.id)}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          {post.author ? <Avatar user={post.author} size={32} /> : <span className="h-8 w-8 rounded-full bg-zinc-800" />}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{post.author?.username ?? "unknown"}</span>
          </span>
          <span className="shrink-0 text-sm text-zinc-500">· {timeAgo(post.createdAt)}</span>
        </button>

        <div className="relative">
          <button
            type="button"
            aria-label="Post options"
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition hover:text-zinc-200"
          >
            <MoreHorizontal size={18} strokeWidth={1.75} />
          </button>
          {menuOpen ? (
            <>
              <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-10 cursor-default" />
              <div className="cliq-pop absolute right-0 top-9 z-20 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#121216] py-1 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    toggleSaved(post.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
                >
                  <Bookmark size={15} strokeWidth={1.75} /> {saved ? "Unsave" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onHide();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-zinc-800"
                >
                  <EyeOff size={15} strokeWidth={1.75} /> Hide
                </button>
                {post.userId === me?.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void remove(post.id);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-[#ff3040] transition hover:bg-zinc-800"
                  >
                    <Trash2 size={15} strokeWidth={1.75} /> Delete
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </header>

      <div
        className="relative w-full cursor-zoom-in overflow-hidden rounded-[4px] border border-white/10 bg-[#121216]"
        onDoubleClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          burstId.current += 1;
          const id = burstId.current;
          setBursts((prev) => [...prev, { id, x: event.clientX - rect.left, y: event.clientY - rect.top }]);
          setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 900);
          if (!liked) void react(post.id, "like", post);
        }}
        onClick={() => {
          const now = Date.now();
          if (now - lastTap.current < 300) {
            lastTap.current = 0;
            return;
          }
          lastTap.current = now;
          setTimeout(() => {
            if (lastTap.current === now) setLightbox(true);
          }, 300);
        }}
      >
        {post.mediaUrl && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.mediaUrl}
            alt={post.content || "Cliq photo"}
            className="max-h-[600px] w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="grid aspect-square w-full place-items-center bg-[#121216] text-zinc-600">
            <ImageIcon size={32} strokeWidth={1.5} />
          </div>
        )}
        {bursts.map((b) => (
          <Heart
            key={b.id}
            size={92}
            className="cliq-reel-heart pointer-events-none absolute z-20 fill-[#ff3040] text-[#ff3040]"
            style={{ left: b.x, top: b.y }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between pb-2 pt-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void react(post.id, "like", post)}
            aria-label="Like"
            className={cx("transition", liked ? "text-[#ff3040]" : "text-zinc-200 hover:text-zinc-400")}
          >
            <Heart size={24} strokeWidth={1.75} className={liked ? "fill-current" : ""} />
          </button>
          <button
            type="button"
            onClick={() => void react(post.id, "dislike", post)}
            aria-label="Dislike"
            className={cx("transition", disliked ? "text-[#f59e0b]" : "text-zinc-200 hover:text-zinc-400")}
          >
            <ThumbsDown size={24} strokeWidth={1.75} className={disliked ? "fill-current" : ""} />
          </button>
          <button type="button" onClick={onComment} aria-label="Comments" className="text-zinc-200 transition hover:text-zinc-400">
            <MessageCircle size={24} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            aria-label="Share"
            className="text-zinc-200 transition hover:text-zinc-400"
          >
            <Send size={24} strokeWidth={1.75} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            toggleSaved(post.id);
            toast(saved ? "Removed from Saved" : "Saved", saved ? "default" : "success");
          }}
          aria-label="Save"
          className={cx("transition", saved ? "text-white" : "text-zinc-200 hover:text-zinc-400")}
        >
          <Bookmark size={24} strokeWidth={1.75} className={saved ? "fill-current" : ""} />
        </button>
      </div>

      <p className="text-sm font-semibold text-white">
        {formatCount(post.likesCount)} like{post.likesCount === 1 ? "" : "s"}
      </p>

      {post.content ? (
        <p className="mt-1 text-sm text-zinc-200">
          <button
            type="button"
            onClick={() => post.author && onOpenProfile(post.author.id)}
            className="font-semibold text-white hover:underline"
          >
            {post.author?.username ?? "unknown"}
          </button>{" "}
          <HashtagText text={post.content} />
        </p>
      ) : null}

      {post.commentCount > 0 ? (
        <button
          type="button"
          onClick={onComment}
          className="mt-1 text-sm text-[#71717a] transition hover:text-zinc-400"
        >
          View all {post.commentCount} comments
        </button>
      ) : null}

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} post={post} />

      {lightbox && post.mediaUrl ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/95 p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full text-white/80 transition hover:text-white"
          >
            <X size={22} strokeWidth={1.75} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.mediaUrl} alt={post.content || "Photo"} className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}
    </article>
  );
}

export function CommentModal({
  post,
  onClose,
  draft,
  setDraft,
}: {
  post: Post | null;
  onClose: () => void;
  draft: string;
  setDraft: (value: string) => void;
}) {
  const { user } = useCliq();
  const { comments, loading, add } = useComments(post?.id ?? "", Boolean(post));

  return (
    <Modal
      open={Boolean(post)}
      onClose={onClose}
      title="Comments"
      subtitle={post ? `@${post.author?.username ?? "unknown"}` : undefined}
    >
      <CommentThread
        comments={comments}
        loading={loading}
        onReply={(parentId, text) => add(text, parentId)}
        canInteract={Boolean(user)}
        toxicFilter
      />
      <div className="sticky bottom-0 mt-4 flex items-center gap-2 border-t border-white/10 bg-[#121216] pt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              void add(draft);
              setDraft("");
            }
          }}
          placeholder="Add a comment..."
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#121216] px-3.5 py-2 text-sm text-white outline-none focus:border-zinc-600"
        />
        <button
          type="button"
          aria-label="Post comment"
          disabled={!draft.trim()}
          onClick={() => {
            if (draft.trim()) {
              void add(draft);
              setDraft("");
            }
          }}
          className="text-sm font-semibold text-[#4f46e5] transition hover:text-white disabled:opacity-40"
        >
          Post
        </button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- bento grid */

/**
 * Masonry tile with a hover overlay showing engagement and author.
 *
 * The image keeps its intrinsic aspect ratio (`w-full h-auto`) so CSS columns
 * produce a real bento layout rather than a uniform grid.
 */
function BentoTile({
  post,
  onOpen,
  onOpenProfile,
}: {
  post: Post;
  onOpen: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const [broken, setBroken] = useState(false);
  const cover = post.mediaUrl;

  return (
    <div className="group relative mb-2 break-inside-avoid overflow-hidden rounded-xl border border-white/10 bg-[#121216]">
      <button type="button" onClick={onOpen} className="block w-full" aria-label="Open photo">
        {cover && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={post.content || "Photo"}
            className="w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="grid aspect-square w-full place-items-center text-2xl text-zinc-600">📸</span>
        )}

        {/* Hover overlay with counts + author */}
        <span className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/20 to-transparent p-2.5 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <span className="flex items-center gap-3 text-[11px] font-bold text-white">
            <span className="inline-flex items-center gap-1">
              <Heart size={12} className="fill-current" /> {formatCount(post.likesCount)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={12} /> {formatCount(post.commentCount)}
            </span>
          </span>
          {post.author ? (
            <span className="mt-1 truncate text-[10px] font-semibold text-white/80">@{post.author.username}</span>
          ) : null}
        </span>
      </button>

      {/* Author chip is a separate tap target so it does not open the lightbox. */}
      {post.author ? (
        <button
          type="button"
          onClick={() => onOpenProfile(post.author!.id)}
          aria-label={`Open ${post.author.displayName}'s profile`}
          className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-bold text-white opacity-0 backdrop-blur-md transition group-hover:opacity-100"
        >
          @{post.author.username}
        </button>
      ) : null}
    </div>
  );
}

/** Full-screen photo viewer with actions. */
function PhotoLightbox({
  post,
  onClose,
  onComment,
  onOpenProfile,
}: {
  post: Post;
  onClose: () => void;
  onComment: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const { savedIds, toggleSaved, toast } = useCliq();
  const saved = savedIds.includes(post.id);

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/95 p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default" />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#121216]">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          {post.author ? (
            <button
              type="button"
              onClick={() => onOpenProfile(post.author!.id)}
              aria-label="Open profile"
              className="shrink-0 rounded-full"
            >
              <Avatar user={post.author} size={36} />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-zinc-100">{post.author?.displayName ?? "Photo"}</p>
            <p className="truncate text-[11px] text-zinc-500">
              @{post.author?.username ?? "unknown"} · {timeAgo(post.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              toggleSaved(post.id);
              toast(saved ? "Removed from Saved" : "Saved to your profile 🔖", saved ? "default" : "success");
            }}
            aria-label="Save"
            className={cx("rounded-full p-2 transition", saved ? "text-[#ff3040]" : "text-zinc-400 hover:text-zinc-100")}
          >
            <Bookmark size={18} className={cx(saved && "fill-current")} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close viewer"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-zinc-400 transition hover:text-zinc-100"
          >
            <X size={16} />
          </button>
        </div>

        {post.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.mediaUrl} alt={post.content || "Photo"} className="max-h-[60vh] w-full object-contain" />
        ) : null}

        <div className="px-4 py-3">
          {post.content ? <p className="text-sm leading-relaxed text-zinc-200">{post.content}</p> : null}
          <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <Heart size={13} /> {formatCount(post.likesCount)}
            </span>
            <button type="button" onClick={onComment} className="inline-flex items-center gap-1 transition hover:text-zinc-100">
              <MessageCircle size={13} /> {formatCount(post.commentCount)} comments
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
