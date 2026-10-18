"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Send,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [gesture, setGesture] = useState<"play" | "pause" | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);

  const liked = post.myReaction === "like";
  const saved = savedIds.includes(post.id);
  const following = followingIds.includes(post.userId);
  const isOwner = post.userId === user?.id;
  const canFollow = Boolean(post.author) && !isOwner;

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
    if (reset) {
      try {
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
      setProgress(0);
    }
  }, []);

  useEffect(() => {
    const slide = slideRef.current;
    if (!slide || broken) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= PLAY_THRESHOLD) play();
          else pause(true);
        }
      },
      { threshold: [0, PLAY_THRESHOLD, 1] },
    );
    observer.observe(slide);
    return () => observer.disconnect();
  }, [play, pause, broken]);

  useEffect(() => {
    if (broken) return;
    if (active) play();
    else pause(true);
  }, [active, play, pause, broken]);

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
      lastTap.current = 0;
      addBurst(x, y);
      if (!liked) void react(post.id, "like", post);
      return;
    }

    lastTap.current = now;
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

  return (
    <div ref={slideRef} data-testid="reel-slide" className="relative h-full w-full" onClick={handleTap}>
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
        <div className="absolute inset-0 grid place-items-center bg-[#0a0a0a]">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full border border-white/15 text-white">
              <Play size={24} className="ml-0.5" strokeWidth={1.75} />
            </span>
            <p className="text-xs text-zinc-500">
              {post.mediaUrl ? "This video can't play here" : "No video attached"}
            </p>
          </div>
        </div>
      )}

      {bursts.map((b) => (
        <Heart
          key={b.id}
          size={96}
          className="cliq-reel-heart pointer-events-none absolute z-30 fill-[#ff3040] text-[#ff3040]"
          style={{ left: b.x, top: b.y }}
        />
      ))}

      {gesture ? (
        <span className="cliq-reel-playpause pointer-events-none absolute left-1/2 top-1/2 z-30 grid h-20 w-20 place-items-center rounded-full bg-black/50 text-white">
          {gesture === "play" ? <Play size={34} className="ml-1" fill="currentColor" /> : <Pause size={34} fill="currentColor" />}
        </span>
      ) : null}

      {!playing && !gesture && !broken ? (
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white/90">
          <Play size={26} className="ml-1" fill="currentColor" />
        </span>
      ) : null}

      {/* Right action rail */}
      <div className="absolute bottom-6 right-3 z-20 flex flex-col items-center gap-5">
        <ActionButton
          label={formatCount(post.likesCount)}
          aria="Like"
          onClick={(e) => {
            e.stopPropagation();
            void react(post.id, "like", post);
          }}
          active={liked}
          icon={<Heart size={28} strokeWidth={1.75} className={cx(liked && "fill-[#ff3040] text-[#ff3040]")} />}
        />

        <ActionButton
          label={formatCount(post.commentCount)}
          aria="Comments"
          onClick={(e) => {
            e.stopPropagation();
            setCommentsOpen(true);
          }}
          icon={<MessageCircle size={28} strokeWidth={1.75} />}
        />

        <ActionButton
          label="Share"
          aria="Share"
          onClick={(e) => {
            e.stopPropagation();
            setShareOpen(true);
          }}
          icon={<Send size={27} strokeWidth={1.75} />}
        />

        <ActionButton
          label="Save"
          aria="Save"
          active={saved}
          onClick={(e) => {
            e.stopPropagation();
            toggleSaved(post.id);
            toast(saved ? "Removed from Saved" : "Saved", saved ? "default" : "success");
          }}
          icon={<Bookmark size={25} strokeWidth={1.75} className={cx(saved && "fill-current")} />}
        />

        <div className="relative">
          <ActionButton
            label="More"
            aria="More"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            icon={<MoreHorizontal size={25} strokeWidth={1.75} />}
          />
          {menuOpen ? (
            <>
              <button
                type="button"
                aria-label="Close menu"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
                className="fixed inset-0 z-10 cursor-default"
              />
              {isOwner ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    void remove(post.id);
                  }}
                  className="cliq-pop absolute bottom-0 right-12 z-20 w-32 rounded-lg border border-zinc-800/80 bg-[#121317] px-3 py-2 text-left text-xs font-semibold text-[#ff3040] shadow-2xl"
                >
                  Delete
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    if (post.author) onOpenProfile(post.author.id);
                  }}
                  className="cliq-pop absolute bottom-0 right-12 z-20 w-32 rounded-lg border border-zinc-800/80 bg-[#121317] px-3 py-2 text-left text-xs font-semibold text-zinc-200 shadow-2xl"
                >
                  View profile
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Bottom-left creator + caption */}
      <div className="absolute inset-x-0 bottom-0 z-10 w-full bg-gradient-to-t from-black/80 via-black/30 to-transparent px-4 pb-5 pt-16 pr-16">
        <div className="flex items-center gap-2.5">
          {post.author ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenProfile(post.author!.id);
              }}
              aria-label="Open profile"
              className="shrink-0 rounded-full"
            >
              <Avatar user={post.author} size={32} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (post.author) onOpenProfile(post.author.id);
            }}
            className="text-sm font-semibold text-white"
          >
            {post.author?.username ?? "unknown"}
          </button>
          {canFollow ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFollow(post.userId);
              }}
              className={cx(
                "rounded-md border px-2.5 py-1 text-xs font-semibold transition",
                following
                  ? "border-white/30 text-white/70 hover:text-white"
                  : "border-white/60 text-white hover:bg-white/10",
              )}
            >
              {following ? "Following" : "Follow"}
            </button>
          ) : null}
        </div>

        {post.content ? (
          <p className="mt-2 text-sm leading-snug text-white">
            <HashtagText
              text={expanded || post.content.length <= 90 ? post.content : `${post.content.slice(0, 90)}...`}
            />
            {post.content.length > 90 ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded((v) => !v);
                  }}
                  className="font-medium text-zinc-400 transition hover:text-white"
                >
                  {expanded ? "less" : "more"}
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      {/* Scrubbing progress bar */}
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
        className="absolute inset-x-0 bottom-0 z-30 h-[2px] cursor-pointer bg-white/25"
      >
        <div className="h-full bg-white transition-[width] duration-150" style={{ width: `${progress}%` }} />
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
}: {
  icon: React.ReactNode;
  label: string;
  aria: string;
  onClick: (e: React.MouseEvent) => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={aria}
      onClick={onClick}
      className="flex flex-col items-center gap-1 transition active:scale-90"
    >
      <span className={cx("grid h-11 w-11 place-items-center rounded-full text-white drop-shadow", active && "bg-white/10")}>
        {icon}
      </span>
      <span className="text-[11px] font-semibold text-white drop-shadow">{label}</span>
    </button>
  );
}
