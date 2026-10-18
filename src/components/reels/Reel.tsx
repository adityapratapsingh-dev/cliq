"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Check,
  Heart,
  MessageCircle,
  Music2,
  Pause,
  Play,
  Plus,
  Send,

  Trash2,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar } from "@/components/ui/Primitives";
import { HashtagText } from "@/components/ui/FeedBits";
import { usePostActions } from "@/components/tabs/usePostActions";
import { ShareSheet } from "@/components/ShareSheet";
import { ReelCommentsSheet } from "@/components/reels/ReelCommentsSheet";
import type { Post } from "@/types/cliq";
import { cx, formatCount } from "@/lib/utils";

/** How much of the slide must be visible before it plays. */
const PLAY_THRESHOLD = 0.65;
/** Gap between taps that still counts as a double tap. */
const DOUBLE_TAP_MS = 280;

interface Burst {
  id: number;
  x: number;
  y: number;
}

export function Reel({
  post,
  muted,
  active,
  onOpenProfile,
}: {
  post: Post;
  muted: boolean;
  onToggleMute: () => void;
  active: boolean;
  onOpenProfile: (id: string) => void;
}) {
  const { user, toast, savedIds, toggleSaved, followingIds, toggleFollow } = useCliq();
  const { react, remove } = usePostActions();

  const videoRef = useRef<HTMLVideoElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const lastTap = useRef(0);
  const burstId = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [gesture, setGesture] = useState<"play" | "pause" | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);

  const liked = post.myReaction === "like";
  const saved = savedIds.includes(post.id);
  const following = followingIds.includes(post.userId);
  const isOwner = post.userId === user?.id;
  const canFollow = post.author && !isOwner;

  const play = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, []);

  const pause = useCallback((reset = false) => {
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    setPlaying(false);
    // Rewind so a reel that scrolls away restarts from the beginning.
    if (reset) {
      try {
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
      setProgress(0);
    }
  }, []);

  /**
   * Autoplay the snapped reel, pause everything else.
   *
   * An IntersectionObserver at 0.65 is what drives this, so only one video is
   * ever audible. The `active` prop is a fallback for browsers/tests where the
   * observer has not fired yet.
   */
  useEffect(() => {
    const slide = slideRef.current;
    if (!slide || broken) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= PLAY_THRESHOLD) {
            play();
          } else {
            pause(true);
          }
        }
      },
      { threshold: [0, PLAY_THRESHOLD, 1] },
    );
    observer.observe(slide);
    return () => observer.disconnect();
  }, [play, pause, broken]);

  // Belt-and-braces: follow the container's active index too.
  useEffect(() => {
    if (broken) return;
    if (active) play();
    else pause(true);
  }, [active, play, pause, broken]);

  // React to the global mute toggle.
  useEffect(() => {
    const el = videoRef.current;
    if (el) el.muted = muted;
  }, [muted]);

  function addBurst(x: number, y: number) {
    burstId.current += 1;
    const id = burstId.current;
    setBursts((prev) => [...prev, { id, x, y }]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== id)), 900);
  }

  function handleTap(event: React.MouseEvent<HTMLDivElement>) {
    const now = Date.now();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (now - lastTap.current < DOUBLE_TAP_MS) {
      // Double tap: heart burst at the tap point + like.
      lastTap.current = 0;
      addBurst(x, y);
      if (!liked) void react(post.id, "like", post);
      return;
    }

    lastTap.current = now;
    // Single tap: toggle playback. Delayed so a double tap can cancel it.
    setTimeout(() => {
      if (lastTap.current !== now) return;
      const el = videoRef.current;
      if (!el) return;
      if (el.paused) {
        play();
        setGesture("play");
      } else {
        pause();
        setGesture("pause");
      }
      setTimeout(() => setGesture(null), 750);
    }, DOUBLE_TAP_MS);
  }

  /** Tap/click anywhere on the progress bar to seek. */
  function seek(event: React.MouseEvent<HTMLDivElement>) {
    const el = videoRef.current;
    if (!el || !el.duration || !Number.isFinite(el.duration)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    try {
      el.currentTime = ratio * el.duration;
      setProgress(ratio * 100);
    } catch {
      /* ignore */
    }
  }

  async function handleDelete() {
    if (!isOwner) return;
    await remove(post.id);
  }

  return (
    <div
      ref={slideRef}
      data-testid="reel-slide"
      className="relative h-full w-full"
      onClick={handleTap}
    >
      {post.mediaUrl && !broken ? (
        <video
          ref={videoRef}
          src={post.mediaUrl}
          className="absolute inset-0 h-full w-full object-cover"
          loop
          muted={muted}
          playsInline
          preload="metadata"
          onError={() => setBroken(true)}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration && Number.isFinite(el.duration)) setProgress((el.currentTime / el.duration) * 100);
          }}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-violet-950 via-fuchsia-950/60 to-cyan-950">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur">
              <Play size={24} className="ml-0.5" />
            </span>
            <p className="text-xs text-zinc-400">
              {post.mediaUrl ? "This reel can't play here" : "No video attached"}
            </p>
          </div>
        </div>
      )}

      {/* Heart bursts */}
      {bursts.map((b) => (
        <Heart
          key={b.id}
          size={96}
          className="cliq-reel-heart pointer-events-none absolute z-30 fill-rose-500 text-rose-500 drop-shadow-[0_0_28px_rgba(244,63,94,0.85)]"
          style={{ left: b.x, top: b.y }}
        />
      ))}

      {/* Centre play/pause feedback */}
      {gesture ? (
        <span className="cliq-reel-playpause pointer-events-none absolute left-1/2 top-1/2 z-30 grid h-20 w-20 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md">
          {gesture === "play" ? <Play size={34} className="ml-1" fill="currentColor" /> : <Pause size={34} fill="currentColor" />}
        </span>
      ) : null}

      {/* Paused indicator (so the state is visible without a gesture) */}
      {!playing && !gesture && !broken ? (
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white/90 backdrop-blur-sm">
          <Play size={26} className="ml-1" fill="currentColor" />
        </span>
      ) : null}

      {/* Right action column */}
      <div className="absolute bottom-20 right-3 z-20 flex flex-col items-center gap-5">
        {post.author ? (
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenProfile(post.author!.id);
              }}
              aria-label={`Open ${post.author.displayName}'s profile`}
              className="block rounded-full transition hover:brightness-110"
            >
              <Avatar user={post.author} size={44} />
              <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/90" />
            </button>
            {canFollow ? (
              <button
                type="button"
                aria-label={following ? "In Cliq" : "Cliq Up"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFollow(post.userId);
                }}
                className={cx(
                  "absolute -bottom-1.5 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full border border-black/60 text-white transition",
                  following ? "bg-emerald-500" : "bg-[var(--accent)]",
                )}
              >
                {following ? <Check size={13} strokeWidth={3} /> : <Plus size={13} strokeWidth={3} />}
              </button>
            ) : null}
          </div>
        ) : null}

        <ActionButton
          label={formatCount(post.likesCount)}
          aria="Like"
          onClick={(e) => {
            e.stopPropagation();
            void react(post.id, "like", post);
          }}
          active={liked}
          icon={
            <Heart
              size={28}
              className={cx(liked && "fill-rose-500 text-rose-500 scale-110")}
            />
          }
        />

        <ActionButton
          label={formatCount(post.commentCount)}
          aria="Comments"
          onClick={(e) => {
            e.stopPropagation();
            setCommentsOpen(true);
          }}
          icon={<MessageCircle size={28} />}
        />

        <ActionButton
          label="Share"
          aria="Share"
          onClick={(e) => {
            e.stopPropagation();
            setShareOpen(true);
          }}
          icon={<Send size={27} />}
        />

        <ActionButton
          label="Save"
          aria="Save"
          active={saved}
          onClick={(e) => {
            e.stopPropagation();
            toggleSaved(post.id);
            toast(saved ? "Removed from Saved" : "Saved to your profile 🔖", saved ? "default" : "success");
          }}
          icon={<Bookmark size={25} className={cx(saved && "fill-current")} />}
        />

        {isOwner ? (
          <ActionButton
            label="Delete"
            aria="Delete Reel"
            tone="danger"
            onClick={(e) => {
              e.stopPropagation();
              void handleDelete();
            }}
            icon={<Trash2 size={23} />}
          />
        ) : null}

        {/* Spinning audio disc */}
        <div className="relative mt-1 grid h-11 w-11 place-items-center">
          <span className="absolute inset-0 animate-spin rounded-full border border-white/20 bg-black/60 [animation-duration:4s]">
            <span className="absolute left-1/2 top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white/40" />
          </span>
          {post.author ? (
            <span className="relative grid h-7 w-7 place-items-center overflow-hidden rounded-full ring-1 ring-white/30">
              <Avatar user={post.author} size={28} />
            </span>
          ) : null}
        </div>
      </div>

      {/* Bottom-left creator + caption */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-4 pb-5 pt-16">
        <div className="pr-20">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (post.author) onOpenProfile(post.author.id);
              }}
              className="text-sm font-bold text-white transition hover:text-[var(--accent-2)]"
            >
              @{post.author?.username ?? "unknown"}
            </button>
            {post.author?.age ? (
              <span className="rounded-full border border-white/20 bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-zinc-200 backdrop-blur">
                {post.author.age}
                {post.author.bio ? ` • ${post.author.bio.slice(0, 18)}` : ""}
              </span>
            ) : null}
            {canFollow && !following ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFollow(post.userId);
                }}
                className="rounded-full border border-white/25 bg-black/40 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur transition hover:bg-black/60"
              >
                Cliq Up
              </button>
            ) : null}
          </div>

          {post.content ? (
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-100">
              <HashtagText text={expanded || post.content.length <= 90 ? post.content : `${post.content.slice(0, 90)}...`} />
              {post.content.length > 90 ? (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpanded((v) => !v);
                    }}
                    className="font-semibold text-zinc-400 transition hover:text-white"
                  >
                    {expanded ? "less" : "more"}
                  </button>
                </>
              ) : null}
            </p>
          ) : null}

          {/* Marquee audio pill */}
          <div className="mt-2 inline-flex max-w-full items-center gap-2 overflow-hidden rounded-full border border-white/15 bg-black/40 px-3 py-1.5 backdrop-blur">
            <Music2 size={12} className="shrink-0 text-zinc-300" />
            <div className="no-scrollbar relative w-40 overflow-hidden">
              <div className="cliq-marquee flex w-max gap-6 whitespace-nowrap text-[11px] text-zinc-200">
                <span>🎵 Original Audio • @{post.author?.username ?? "unknown"}</span>
                <span>🎵 Original Audio • @{post.author?.username ?? "unknown"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrubbing progress bar, fixed to the very bottom edge */}
      <div
        role="slider"
        aria-label="Seek"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          seek(e);
        }}
        onKeyDown={(e) => {
          const el = videoRef.current;
          if (!el || !el.duration || !Number.isFinite(el.duration)) return;
          if (e.key === "ArrowRight") el.currentTime = Math.min(el.duration, el.currentTime + 5);
          if (e.key === "ArrowLeft") el.currentTime = Math.max(0, el.currentTime - 5);
        }}
        className="absolute inset-x-0 bottom-0 z-30 h-1 cursor-pointer bg-white/20"
      >
        <div
          className="h-full bg-indigo-600 transition-[width] duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ReelCommentsSheet post={post} open={commentsOpen} onClose={() => setCommentsOpen(false)} />

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} post={post} />
    </div>
  );
}

function ActionButton({
  icon,
  label,
  aria,
  onClick,
  active,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  aria: string;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      aria-label={aria}
      onClick={onClick}
      className="flex flex-col items-center gap-1 transition active:scale-90"
    >
      <span
        className={cx(
          "grid h-11 w-11 place-items-center rounded-full transition",
          tone === "danger" ? "text-zinc-300 hover:text-rose-400" : "text-white",
          active && tone !== "danger" && "bg-white/10",
        )}
      >
        {icon}
      </span>
      <span className="text-[11px] font-semibold text-white drop-shadow">{label}</span>
    </button>
  );
}

