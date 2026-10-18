"use client";

import { useState } from "react";
import { useRef } from "react";
import { Bookmark, EyeOff, Heart, Image as ImageIcon, MessageCircle, MoreHorizontal, Send, Share2, Trash2, X, ZoomIn } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar, EmptyState, IconButton, Modal, SkeletonCard } from "@/components/ui/Primitives";
import { CommentThread, HashtagText, LikePair } from "@/components/ui/FeedBits";
import { ShareSheet } from "@/components/ShareSheet";
import { matchesSearch, useComments, useFeed } from "@/components/tabs/useFeed";
import { usePostActions } from "@/components/tabs/usePostActions";
import type { Post } from "@/types/cliq";
import { cx, timeAgo } from "@/lib/utils";

export function PhotosTab({ search, onOpenProfile }: { search: string; onOpenProfile: (id: string) => void }) {
  const { posts, loading } = useFeed("photo");
  const { setCreateOpen, settings, user } = useCliq();
  const [draft, setDraft] = useState("");
  const [commentTarget, setCommentTarget] = useState<Post | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);

  const visible = posts.filter((p) => !hidden.includes(p.id) && matchesSearch(p, search));

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[620px] space-y-5 px-3 py-4 sm:px-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[620px] px-4 py-10">
        <EmptyState
          icon={<ImageIcon size={26} />}
          title={search ? "No photos match that search" : "No photos on Cliq yet"}
          hint={
            search
              ? "Try a different vibe or clear the search bar."
              : "Be the first to post a Photo! Upload one or paste a link."
          }
          actionLabel={search ? undefined : "Post a Photo"}
          onAction={search ? undefined : () => setCreateOpen(true)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-5 px-3 py-4 sm:px-4">
      {visible.map((post) => (
        <PhotoCard
          key={post.id}
          post={post}
          onComment={() => setCommentTarget(post)}
          onHide={() => setHidden((prev) => [...prev, post.id])}
          onOpenProfile={onOpenProfile}
          hideDislikes={settings.hideDislikes && post.userId === user?.id}
        />
      ))}

      <CommentModal post={commentTarget} onClose={() => setCommentTarget(null)} draft={draft} setDraft={setDraft} />
    </div>
  );
}

export function PhotoCard({
  post,
  onComment,
  onHide,
  onOpenProfile,
  hideDislikes,
}: {
  post: Post;
  onComment: () => void;
  onHide: () => void;
  onOpenProfile: (id: string) => void;
  hideDislikes: boolean;
}) {
  const { toast, savedIds, toggleSaved } = useCliq();
  const { react, remove } = usePostActions();
  const { user: me } = useCliq();
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
    <article className="cliq-rise overflow-hidden rounded-3xl border border-zinc-800/80 bg-[#121317]">
      <header className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => post.author && onOpenProfile(post.author.id)}
          className="shrink-0 rounded-full transition hover:brightness-110"
          aria-label="Open profile"
        >
          {post.author ? (
            <Avatar user={post.author} size={42} ring />
          ) : (
            <span className="h-10 w-10 rounded-full bg-zinc-800" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => post.author && onOpenProfile(post.author.id)}
            className="block max-w-full truncate text-left text-sm font-bold text-zinc-100 transition hover:text-[var(--accent-2)]"
          >
            {post.author?.displayName ?? "Cliq User"}
          </button>
          <button
            type="button"
            onClick={() => post.author && onOpenProfile(post.author.id)}
            className="block max-w-full truncate text-left text-[11px] text-zinc-500 transition hover:text-[var(--accent-2)]"
          >
            @{post.author?.username ?? "unknown"} · {timeAgo(post.createdAt)}
          </button>
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label="Post options"
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            <MoreHorizontal size={18} />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div className="cliq-pop absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#121317]/98 py-1 shadow-2xl backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => {
                    toggleSaved(post.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800/70 hover:text-zinc-100"
                >
                  <Bookmark size={14} /> {saved ? "Unsave Post" : "Save Post"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onHide();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800/70 hover:text-zinc-100"
                >
                  <EyeOff size={14} /> Hide
                </button>
                {post.userId === me?.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void remove(post.id);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-semibold text-rose-300 transition hover:bg-zinc-800/70"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </header>

      <div
        className="relative aspect-square w-full cursor-zoom-in bg-zinc-950 sm:aspect-[4/3]"
        onDoubleClick={(event) => {
          // Double-tap to like, with a heart at the pointer.
          const rect = event.currentTarget.getBoundingClientRect();
          burstId.current += 1;
          const id = burstId.current;
          setBursts((prev) => [...prev, { id, x: event.clientX - rect.left, y: event.clientY - rect.top }]);
          setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 900);
          if (!liked) void react(post.id, "like", post);
        }}
        onClick={() => {
          // A single click opens the lightbox; a double tap must not.
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
            className="h-full w-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-violet-900/40 via-fuchsia-900/30 to-cyan-900/40">
            <p className="text-xs text-zinc-400">{post.mediaUrl ? "This image can't load" : "No image attached"}</p>
          </div>
        )}
        {bursts.map((b) => (
          <Heart
            key={b.id}
            size={92}
            className="cliq-reel-heart pointer-events-none absolute z-20 fill-rose-500 text-rose-500 drop-shadow-[0_0_26px_rgba(244,63,94,0.85)]"
            style={{ left: b.x, top: b.y }}
          />
        ))}
        <span className="pointer-events-none absolute bottom-3 right-3 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white/80 backdrop-blur">
          <ZoomIn size={13} />
        </span>
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-0.5">
          <LikePair
            likes={post.likesCount}
            liked={liked}
            dislikes={post.dislikesCount}
            disliked={disliked}
            hideDislikes={hideDislikes}
            onLike={() => void react(post.id, "like", post)}
            onDislike={() => void react(post.id, "dislike", post)}
          />
          <IconButton icon={<MessageCircle size={19} />} count={post.commentCount} onClick={onComment} title="Comments" />
          <IconButton icon={<Share2 size={19} />} onClick={() => setShareOpen(true)} title="Share" />
        </div>
        <IconButton
          icon={<Bookmark size={19} className={cx(saved && "fill-current")} />}
          active={saved}
          onClick={() => {
            toggleSaved(post.id);
            toast(saved ? "Removed from Saved" : "Saved to your profile 🔖", saved ? "default" : "success");
          }}
          title="Save"
        />
      </div>

      <ReactionRatio likes={post.likesCount} dislikes={post.dislikesCount} hideDislikes={hideDislikes} />

      {post.content ? (
        <div className="px-4 pb-4">
          <p className="text-sm text-zinc-200">
            <button
              type="button"
              onClick={() => post.author && onOpenProfile(post.author.id)}
              className="font-bold text-zinc-50 transition hover:text-[var(--accent-2)]"
            >
              @{post.author?.username ?? "unknown"}
            </button>{" "}
            <HashtagText text={post.content} />
          </p>
          <button
            type="button"
            onClick={onComment}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 transition hover:text-zinc-300"
          >
            <MessageCircle size={13} /> View all {post.commentCount} comments
          </button>
        </div>
      ) : null}

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} post={post} />

      {lightbox && post.mediaUrl ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/95 p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border border-white/20 text-white/80 transition hover:text-white"
          >
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.mediaUrl}
            alt={post.content || "Photo"}
            className="max-h-full max-w-full rounded-2xl object-contain"
          />
        </div>
      ) : null}
    </article>
  );
}

/** Shows how the community split between likes and dislikes. */
function ReactionRatio({
  likes,
  dislikes,
  hideDislikes,
}: {
  likes: number;
  dislikes: number;
  hideDislikes: boolean;
}) {
  const total = likes + dislikes;
  if (hideDislikes || total === 0) return null;
  const pct = Math.round((likes / total) * 100);
  return (
    <div className="px-4 pb-1">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <span className="h-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        <span className="h-full bg-rose-500/80 transition-[width] duration-300" style={{ width: `${100 - pct}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-zinc-500">
        <span>{pct}% liked</span>
        <span>{100 - pct}% disliked</span>
      </div>
    </div>
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
      subtitle={post ? `On @${post.author?.username ?? "unknown"}'s post` : undefined}
    >
      <CommentThread
        comments={comments}
        loading={loading}
        onReply={(parentId, text) => add(text, parentId)}
        canInteract={Boolean(user)}
        toxicFilter
      />
      <div className="sticky bottom-0 mt-4 flex items-center gap-2 border-t border-zinc-800/80 bg-zinc-900/95 pt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              void add(draft);
              setDraft("");
            }
          }}
          placeholder="Add a comment on Cliq..."
          className="min-w-0 flex-1 rounded-full border border-zinc-800 bg-zinc-950/70 px-3.5 py-2 text-sm text-zinc-100 outline-none focus:border-[var(--accent)]"
        />
        <button
          type="button"
          aria-label="Post comment"
          onClick={() => {
            if (draft.trim()) {
              void add(draft);
              setDraft("");
            }
          }}
          className="grid h-9 w-9 place-items-center rounded-full bg-indigo-600 text-white"
        >
          <Send size={15} />
        </button>
      </div>
    </Modal>
  );
}
