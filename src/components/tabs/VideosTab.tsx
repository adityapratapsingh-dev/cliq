"use client";

import { useEffect, useRef, useState } from "react";
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
  Share2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { CommentDrawer, ShareSheet } from "@/components/CreateModal";
import { Avatar, GradientArt } from "@/components/ui/Primitives";
import { CommentThread, HashtagText } from "@/components/ui/FeedBits";
import { cx, formatCount } from "@/lib/utils";

export function VideosTab() {
  const { videos, userMap, searchQuery, settings, followingIds, toggleFollow, me } = useCliq();

  const filtered = videos.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().replace("#", "");
    const a = userMap[v.authorId];
    return (
      v.caption.toLowerCase().includes(q) ||
      v.hashtags.some((h) => h.toLowerCase().includes(q)) ||
      (a && (a.name.toLowerCase().includes(q) || a.handle.toLowerCase().includes(q)))
    );
  });

  if (filtered.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <span className="text-4xl">🎬</span>
        <p className="text-sm font-semibold text-zinc-200">No videos match that search</p>
        <p className="text-xs text-zinc-500">Try a different vibe or clear the search bar.</p>
      </div>
    );
  }

  return (
    <div className="cliq-scroll snap-y-mandatory h-[calc(100dvh-9rem)] overflow-y-scroll overscroll-contain lg:h-[calc(100dvh-5rem)]">
      {filtered.map((video) => (
        <VideoCard
          key={video.id}
          videoId={video.id}
          autoplayGlobal={settings.autoplay}
          isFollowing={followingIds.includes(video.authorId) || video.authorId === me.id}
          onToggleFollow={() => toggleFollow(video.authorId)}
        />
      ))}
    </div>
  );
}

function VideoCard({
  videoId,
  autoplayGlobal,
  isFollowing,
  onToggleFollow,
}: {
  videoId: string;
  autoplayGlobal: boolean;
  isFollowing: boolean;
  onToggleFollow: () => void;
}) {
  const {
    videos,
    userMap,
    me,
    toggleVideoLike,
    toggleVideoSave,
    toggleVideoRepost,
    addComment,
    toggleCommentLike,
  } = useCliq();
  const video = videos.find((v) => v.id === videoId);
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [flash, setFlash] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!video) return;
    const el = ref.current;
    if (!el) return;
    if (autoplayGlobal) {
      el.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  }, [autoplayGlobal, video]);

  if (!video) return null;
  const author = userMap[video.authorId];
  if (!author) return null;

  function togglePlay() {
    const el = ref.current;
    if (!el) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 400);
    if (el.paused) {
      el.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  return (
    <section className="snap-start-always relative mx-auto flex h-full w-full max-w-md items-center justify-center px-0 py-3 lg:py-5">
      <div className="relative h-full w-full overflow-hidden rounded-none border-zinc-800/80 bg-zinc-900/80 backdrop-blur-md lg:rounded-3xl lg:border">
        {!failed ? (
          <video
            ref={ref}
            src={video.src}
            loop
            muted={muted}
            playsInline
            preload="metadata"
            onClick={togglePlay}
            onError={() => setFailed(true)}
            onTimeUpdate={(e) => {
              const el = e.currentTarget;
              if (el.duration) setProgress((el.currentTime / el.duration) * 100);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer bg-black object-cover"
          />
        ) : null}

        {/* Gradient fallback art — always rendered behind so a broken player never shows */}
        <GradientArt
          art={video.art}
          className={cx("absolute inset-0", failed ? "" : playing ? "opacity-0" : "opacity-100")}
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/10 to-zinc-950/50" />

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3.5">
          <span className="rounded-full border border-zinc-700/60 bg-zinc-950/60 px-3 py-1 text-[11px] font-bold text-zinc-200 backdrop-blur">
            {video.art.label}
          </span>
          <button
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => setMuted((m) => !m)}
            className="grid h-9 w-9 place-items-center rounded-full border border-zinc-700/60 bg-zinc-950/60 text-zinc-100 backdrop-blur transition hover:border-[var(--accent)]"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>

        {/* center play/pause overlay */}
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={togglePlay}
          className="absolute inset-0 grid place-items-center"
        >
          <span
            className={cx(
              "grid h-16 w-16 place-items-center rounded-full border border-white/20 bg-zinc-950/50 text-white backdrop-blur transition",
              playing ? "opacity-0" : "opacity-100",
              flash && "scale-110",
            )}
          >
            <Play size={26} className="ml-1" fill="currentColor" />
          </span>
        </button>

        {/* right action column */}
        <div className="absolute bottom-24 right-2.5 flex flex-col items-center gap-4">
          <div className="relative">
            <Avatar user={author} size={46} ring />
            <button
              type="button"
              aria-label={isFollowing ? "In Cliq" : "Add to Cliq"}
              onClick={onToggleFollow}
              disabled={author.id === me.id}
              className={cx(
                "absolute -bottom-1.5 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full border border-zinc-950 text-white transition disabled:opacity-0",
                isFollowing ? "bg-emerald-500" : "bg-[var(--accent)]",
              )}
            >
              {isFollowing ? <Check size={13} strokeWidth={3} /> : <Plus size={13} strokeWidth={3} />}
            </button>
          </div>

          <ActionButton
            active={video.liked}
            activeColor="#fb7185"
            icon={<Heart size={24} className={video.liked ? "fill-current" : ""} />}
            label={formatCount(video.likes)}
            onClick={() => toggleVideoLike(video.id)}
          />
          <ActionButton
            icon={<MessageCircle size={24} />}
            label={formatCount(video.comments.length)}
            onClick={() => setCommentsOpen(true)}
          />
          <ActionButton
            icon={<Share2 size={23} />}
            label={formatCount(video.shares)}
            onClick={() => setShareOpen(true)}
          />
          <ActionButton
            active={video.saved}
            activeColor="var(--accent-2)"
            icon={<Bookmark size={22} className={video.saved ? "fill-current" : ""} />}
            label="Save"
            onClick={() => toggleVideoSave(video.id)}
          />

          <div className="cliq-spin-disc grid h-11 w-11 place-items-center rounded-full border border-zinc-700/60 bg-zinc-950/70">
            <Music2 size={18} className="text-[var(--accent-2)]" />
          </div>
        </div>

        {/* bottom-left info */}
        <div className="absolute bottom-16 left-3.5 right-20 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">@{author.handle}</span>
            <span className="rounded-full border border-zinc-700/60 bg-zinc-950/60 px-2 py-0.5 text-[10px] font-semibold text-zinc-200 backdrop-blur">
              {author.age} • {author.vibe}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-zinc-200">
            <HashtagText text={expanded ? video.caption : `${video.caption.slice(0, 92)}${video.caption.length > 92 ? "..." : ""}`} />{" "}
            {video.caption.length > 92 ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="font-semibold text-zinc-400 hover:text-zinc-100"
              >
                {expanded ? "less" : "more"}
              </button>
            ) : null}
          </p>
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Music2 size={12} className="shrink-0 text-zinc-300" />
            <div className="relative w-44 overflow-hidden">
              <div className="flex w-max cliq-marquee gap-6 whitespace-nowrap text-[11px] text-zinc-300">
                <span>{video.audio}</span>
                <span>{video.audio}</span>
              </div>
            </div>
          </div>
        </div>

        {/* progress bar */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
          <div
            className="h-full bg-[var(--accent-grad)] transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} title={`@${author.handle}'s video`} />

      <CommentDrawer
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        title={`Comments · ${video.comments.length}`}
      >
        <CommentThread
          comments={video.comments}
          userMap={userMap}
          onLike={(cid) => toggleCommentLike("video", video.id, cid)}
          onReply={(cid, text) => addComment("video", video.id, text, cid)}
        />
        <div className="sticky bottom-0 mt-4 flex items-center gap-2 border-t border-zinc-800/80 bg-zinc-900/95 pt-3">
          <Avatar user={me} size={32} />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addComment("video", video.id, draft);
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
              addComment("video", video.id, draft);
              setDraft("");
            }}
            className="grid h-9 w-9 place-items-center rounded-full bg-[var(--accent-grad)] text-white"
          >
            <Send size={15} />
          </button>
        </div>
      </CommentDrawer>

      {/* repost toast hint */}
      <button
        type="button"
        aria-label="Repost"
        onClick={() => toggleVideoRepost(video.id)}
        className={cx(
          "absolute right-3.5 top-16 rounded-full border px-3 py-1 text-[10px] font-bold backdrop-blur transition",
          video.reposted
            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-zinc-100"
            : "border-zinc-700/60 bg-zinc-950/50 text-zinc-300 hover:text-white",
        )}
      >
        {video.reposted ? "Reposted ✓" : "Repost"}
      </button>

      {flash && !playing ? (
        <span className="pointer-events-none absolute grid h-20 w-20 place-items-center rounded-full bg-zinc-950/50">
          <Pause size={30} className="text-white" fill="currentColor" />
        </span>
      ) : null}
    </section>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  active,
  activeColor,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-0.5">
      <span
        className={cx(
          "grid h-11 w-11 place-items-center rounded-full transition active:scale-90",
          active ? "bg-white/10" : "bg-zinc-950/40 backdrop-blur hover:bg-white/10",
        )}
        style={active ? { color: activeColor } : { color: "#fff" }}
      >
        {icon}
      </span>
      <span className="text-[10px] font-bold text-white drop-shadow">{label}</span>
    </button>
  );
}
