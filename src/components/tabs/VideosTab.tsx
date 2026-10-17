"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Film, Plus, Volume2, VolumeX } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { EmptyState, SkeletonCard } from "@/components/ui/Primitives";
import { matchesSearch, useFeed } from "@/components/tabs/useFeed";
import { Reel } from "@/components/reels/Reel";
import type { Post } from "@/types/cliq";
import { cx } from "@/lib/utils";

type FeedMode = "forYou" | "following";

/**
 * Instagram Reels / TikTok style vertical player.
 *
 * One scroll container with snap points; each slide is a full-height reel. Only
 * the snapped slide plays (driven by an IntersectionObserver inside `Reel`), so
 * audio tracks never overlap.
 */
export function VideosTab({ search, onOpenProfile }: { search: string; onOpenProfile: (id: string) => void }) {
  const { setCreateOpen, followingIds } = useCliq();
  const { posts, loading } = useFeed("video");
  const [mode, setMode] = useState<FeedMode>("forYou");
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const bySearch = posts.filter((p) => matchesSearch(p, search));
  const visible: Post[] = mode === "following" ? bySearch.filter((p) => followingIds.includes(p.userId)) : bySearch;

  // Keep the "N / M" indicator in sync with the snapped slide.
  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const index = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
    setActiveIndex(Math.min(Math.max(0, index), Math.max(0, visible.length - 1)));
  }, [visible.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  const goTo = useCallback(
    (index: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const target = Math.min(Math.max(0, index), Math.max(0, visible.length - 1));
      el.scrollTo({ top: target * el.clientHeight, behavior: "smooth" });
    },
    [visible.length],
  );

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[430px] px-4 py-6">
        <SkeletonCard />
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[430px] px-4 py-10">
        <EmptyState
          icon={<Film size={26} />}
          title={
            search
              ? "No reels match that search"
              : mode === "following"
                ? "No reels from people you follow"
                : "No reels on Cliq yet"
          }
          hint={
            search
              ? "Try a different vibe or clear the search bar."
              : mode === "following"
                ? "Cliq Up creators or switch back to For You to see everything."
                : "Be the first to post a Reel! Upload a clip or paste a link."
          }
          actionLabel={mode === "forYou" && !search ? "Post a Reel" : undefined}
          onAction={mode === "forYou" && !search ? () => setCreateOpen(true) : undefined}
        />
      </div>
    );
  }

  return (
    <div className="relative flex w-full justify-center lg:py-2">
      {/* Floating prev/next for tablet & desktop, outside the phone frame. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-center lg:flex">
        <div className="relative h-full w-full max-w-[430px]">
          <div className="pointer-events-auto absolute -right-16 top-1/2 flex -translate-y-1/2 flex-col gap-3">
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              disabled={activeIndex <= 0}
              aria-label="Previous Reel"
              className="group inline-flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-900/80 px-3 py-2.5 text-[11px] font-bold text-zinc-300 backdrop-blur-md transition hover:border-[var(--accent)] hover:text-zinc-100 disabled:opacity-30"
            >
              <ChevronUp size={16} />
              <span className="hidden xl:inline">Previous</span>
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              disabled={activeIndex >= visible.length - 1}
              aria-label="Next Reel"
              className="group inline-flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-900/80 px-3 py-2.5 text-[11px] font-bold text-zinc-300 backdrop-blur-md transition hover:border-[var(--accent)] hover:text-zinc-100 disabled:opacity-30"
            >
              <ChevronDown size={16} />
              <span className="hidden xl:inline">Next</span>
            </button>
          </div>
        </div>
      </div>

      {/* Phone frame on tablet/desktop; full-bleed on mobile. */}
      <div
        className={cx(
          "relative w-full bg-black",
          "h-[calc(100dvh-7.5rem)]",
          "lg:h-[calc(100dvh-5.5rem)] lg:aspect-[9/16] lg:max-w-[430px] lg:rounded-2xl lg:border lg:border-zinc-800/80 lg:shadow-2xl",
        )}
      >
        {/* Top overlay */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-3">
          <div className="pointer-events-auto flex gap-1.5">
            {(
              [
                { key: "forYou", label: "For You" },
                { key: "following", label: "Following" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMode(key);
                  scrollerRef.current?.scrollTo({ top: 0 });
                }}
                className={cx(
                  "rounded-full px-3 py-1.5 text-[11px] font-bold backdrop-blur-md transition",
                  mode === key
                    ? "bg-white/95 text-zinc-900"
                    : "bg-black/35 text-zinc-200 hover:bg-black/55",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => setMuted((m) => !m)}
              className="grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md transition hover:bg-black/55"
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <button
              type="button"
              aria-label="Post a Reel"
              onClick={() => setCreateOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur-md transition hover:bg-black/55"
            >
              <Plus size={17} strokeWidth={3} />
            </button>
          </div>
        </div>

        {/* Counter */}
        <span className="pointer-events-none absolute left-1/2 top-14 z-30 -translate-x-1/2 rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-semibold text-zinc-200 backdrop-blur-md lg:hidden">
          {activeIndex + 1} / {visible.length}
        </span>

        <div
          ref={scrollerRef}
          data-testid="reels-scroller"
          className="no-scrollbar h-full w-full snap-y snap-mandatory overflow-y-scroll scroll-smooth"
        >
          {visible.map((post, index) => (
            <div
              key={post.id}
              className="relative flex h-full w-full snap-start snap-always items-center justify-center overflow-hidden bg-black select-none"
            >
              <Reel
                post={post}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
                active={index === activeIndex}
                onOpenProfile={onOpenProfile}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
