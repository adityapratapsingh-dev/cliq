"use client";

import { useState } from "react";
import { Bookmark, EyeOff, Heart, Image as ImageIcon, MessageCircle, MoreHorizontal, Send, Share2 } from "lucide-react";
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
      <div className="mx-auto w-full max-w-2xl space-y-5 px-3 py-4 sm:px-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
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
    <div className="mx-auto w-full max-w-2xl space-y-5 px-3 py-4 sm:px-4">
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
  const { react } = usePostActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [broken, setBroken] = useState(false);

  const liked = post.myReaction === "like";
  const disliked = post.myReaction === "dislike";
  const saved = savedIds.includes(post.id);

  return (
    <article className="cliq-rise overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/80 backdrop-blur-md">
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
              <div className="cliq-pop absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/95 py-1 shadow-2xl backdrop-blur-xl">
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
              </div>
            </>
          ) : null}
        </div>
      </header>

      <div className="relative aspect-square w-full bg-zinc-950 sm:aspect-[4/3]">
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
        {liked ? (
          <span className="pointer-events-none absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-rose-500/90 text-white">
            <Heart size={16} className="fill-current" />
          </span>
        ) : null}
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

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title={`@${post.author?.username ?? "unknown"}'s photo`}
      />
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
          className="grid h-9 w-9 place-items-center rounded-full bg-[var(--accent-grad)] text-white"
        >
          <Send size={15} />
        </button>
      </div>
    </Modal>
  );
}
