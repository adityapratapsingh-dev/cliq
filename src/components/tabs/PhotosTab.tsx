"use client";

import { useState } from "react";
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Flag,
  Heart,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Share2,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { ShareSheet } from "@/components/CreateModal";
import { Avatar, GradientArt } from "@/components/ui/Primitives";
import { CommentThread, HashtagText } from "@/components/ui/FeedBits";
import { cx, formatCount, timeAgo } from "@/lib/utils";

export function PhotosTab() {
  const { photos, userMap, followingIds, toggleFollowingId, me, searchQuery, settings } = useCliq();

  const visible = photos.filter((p) => {
    if (p.hidden) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().replace("#", "");
    const a = userMap[p.authorId];
    return (
      p.caption.toLowerCase().includes(q) ||
      p.hashtags.some((h) => h.toLowerCase().includes(q)) ||
      (a && (a.name.toLowerCase().includes(q) || a.handle.toLowerCase().includes(q)))
    );
  });

  if (visible.length === 0) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-center">
        <span className="text-4xl">📸</span>
        <p className="text-sm font-semibold text-zinc-200">Nothing here yet</p>
        <p className="text-xs text-zinc-500">Adjust your search or create a new photo post.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-3 py-4 sm:px-4">
      {visible.map((photo) => (
        <PhotoCard
          key={photo.id}
          photoId={photo.id}
          isFollowing={followingIds.includes(photo.authorId) || photo.authorId === me.id}
          onToggleFollow={() => toggleFollowingId(photo.authorId)}
          hideDislikes={settings.hideDislikes && userMap[photo.authorId]?.id === me.id}
        />
      ))}
    </div>
  );
}

function PhotoCard({
  photoId,
  isFollowing,
  onToggleFollow,
  hideDislikes,
}: {
  photoId: string;
  isFollowing: boolean;
  onToggleFollow: () => void;
  hideDislikes: boolean;
}) {
  const {
    photos,
    userMap,
    me,
    togglePhotoLike,
    togglePhotoDislike,
    togglePhotoSave,
    hidePhoto,
    addComment,
    toggleCommentLike,
    toast,
  } = useCliq();
  const photo = photos.find((p) => p.id === photoId);
  const [index, setIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [burst, setBurst] = useState(0);
  const [lastTap, setLastTap] = useState(0);

  if (!photo) return null;
  const author = userMap[photo.authorId];
  if (!author) return null;
  const total = photo.images.length;

  function handleDoubleTap() {
    const now = Date.now();
    if (now - lastTap < 320) {
      setBurst((b) => b + 1);
      if (!photo?.liked) togglePhotoLike(photoId);
    }
    setLastTap(now);
  }

  return (
    <article className="cliq-rise overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/80 backdrop-blur-md">
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar user={author} size={42} ring={author.online} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-zinc-100">{author.name}</span>
            {author.verified ? <span className="text-[var(--accent-2)]">✦</span> : null}
          </div>
          <p className="truncate text-[11px] text-zinc-500">
            @{author.handle} · {author.age} · {author.vibe} · {timeAgo(photo.createdAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleFollow}
          disabled={author.id === me.id}
          className={cx(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-0",
            isFollowing
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
              : "border-[var(--accent)] bg-[var(--accent-soft)] text-zinc-100",
          )}
        >
          {isFollowing ? <Check size={12} strokeWidth={3} /> : <Plus size={12} strokeWidth={3} />}
          {isFollowing ? "In Cliq" : "Cliq Up"}
        </button>
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
                {[
                  {
                    label: photo.saved ? "Unsave Post" : "Save Post",
                    icon: Bookmark,
                    run: () => togglePhotoSave(photo.id),
                  },
                  { label: "Hide", icon: EyeOff, run: () => hidePhoto(photo.id) },
                  {
                    label: "Report",
                    icon: Flag,
                    run: () => toast("Report sent to Cliq safety team 🛡️", "danger"),
                  },
                  {
                    label: "Copy Link",
                    icon: Link2,
                    run: () => toast("Link copied to clipboard 🔗", "success"),
                  },
                ].map(({ label, icon: Icon, run }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      run();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800/70 hover:text-zinc-100"
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </header>

      <div className="relative select-none" onClick={handleDoubleTap}>
        <GradientArt art={photo.images[index]} className="aspect-square w-full sm:aspect-[4/3]">
          {burst > 0 ? (
            <span key={burst} className="cliq-heart-pop pointer-events-none absolute inset-0 grid place-items-center">
              <Heart size={90} className="text-rose-500 drop-shadow-[0_0_24px_rgba(244,63,94,0.8)]" fill="currentColor" />
            </span>
          ) : null}
        </GradientArt>

        {total > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => {
                e.stopPropagation();
                setIndex((i) => (i - 1 + total) % total);
              }}
              className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-zinc-950/50 text-white backdrop-blur transition hover:bg-zinc-950/80"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => {
                e.stopPropagation();
                setIndex((i) => (i + 1) % total);
              }}
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-zinc-950/50 text-white backdrop-blur transition hover:bg-zinc-950/80"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {photo.images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to photo ${i + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex(i);
                  }}
                  className={cx(
                    "h-1.5 rounded-full transition-all",
                    i === index ? "w-5 bg-white" : "w-1.5 bg-white/50",
                  )}
                />
              ))}
            </div>
            <span className="absolute right-3 top-3 rounded-full bg-zinc-950/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
              {index + 1}/{total}
            </span>
          </>
        ) : null}

        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-zinc-950/60 px-2.5 py-1 text-[10px] font-semibold text-zinc-100 backdrop-blur">
          {photo.images[index].emoji} {photo.images[index].label}
        </span>
      </div>

      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => togglePhotoLike(photo.id)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-bold transition active:scale-90",
              photo.liked ? "text-rose-400" : "text-zinc-300 hover:bg-zinc-800/70",
            )}
          >
            <Heart size={20} className={cx(photo.liked && "fill-current")} />
            <span className="tabular-nums">{formatCount(photo.likes)}</span>
          </button>
          <button
            type="button"
            onClick={() => togglePhotoDislike(photo.id)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-bold transition active:scale-90",
              photo.disliked ? "text-orange-400" : "text-zinc-400 hover:bg-zinc-800/70",
            )}
          >
            {photo.disliked ? <ThumbsDown size={19} className="fill-current" /> : <ThumbsUp size={19} />}
            <span className="tabular-nums">{hideDislikes ? "—" : formatCount(photo.dislikes)}</span>
          </button>
          <button
            type="button"
            onClick={() => setCommentsOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-bold text-zinc-300 transition hover:bg-zinc-800/70 active:scale-90"
          >
            <MessageCircle size={19} />
            <span className="tabular-nums">{formatCount(photo.comments.length)}</span>
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-bold text-zinc-300 transition hover:bg-zinc-800/70 active:scale-90"
          >
            <Share2 size={19} />
          </button>
        </div>
        <button
          type="button"
          aria-label="Save post"
          onClick={() => togglePhotoSave(photo.id)}
          className={cx(
            "rounded-full p-2 transition active:scale-90",
            photo.saved ? "text-[var(--accent-2)]" : "text-zinc-300 hover:bg-zinc-800/70",
          )}
        >
          <Bookmark size={19} className={cx(photo.saved && "fill-current")} />
        </button>
      </div>

      <div className="px-4 pb-3">
        <p className="text-sm text-zinc-200">
          <span className="font-bold text-zinc-50">@{author.handle}</span>{" "}
          <HashtagText text={photo.caption} />
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {photo.hashtags.map((h) => (
            <span key={h} className="text-[11px] font-semibold text-[var(--accent-2)]">
              #{h}
            </span>
          ))}
        </div>

        {commentsOpen ? (
          <div className="mt-3 rounded-2xl border border-zinc-800/70 bg-zinc-950/50 p-3">
            <CommentThread
              comments={photo.comments}
              userMap={userMap}
              onLike={(cid) => toggleCommentLike("photo", photo.id, cid)}
              onReply={(cid, text) => addComment("photo", photo.id, text, cid)}
              compact
            />
            <div className="mt-3 flex items-center gap-2">
              <Avatar user={me} size={30} showOnline={false} />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addComment("photo", photo.id, draft);
                    setDraft("");
                  }
                }}
                placeholder="Add a comment on Cliq..."
                className="min-w-0 flex-1 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs text-zinc-100 outline-none focus:border-[var(--accent)]"
              />
              <button
                type="button"
                onClick={() => {
                  addComment("photo", photo.id, draft);
                  setDraft("");
                }}
                className="rounded-full bg-[var(--accent-grad)] px-3 py-1.5 text-[11px] font-bold text-white"
              >
                Post
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            className="mt-2 text-xs font-semibold text-zinc-500 transition hover:text-zinc-300"
          >
            View all {photo.comments.length} comments
          </button>
        )}
      </div>

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} title={`@${author.handle}'s photo`} />
    </article>
  );
}
