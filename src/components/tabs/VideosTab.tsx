"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Film, Volume2, VolumeX } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { EmptyState, SkeletonCard } from "@/components/ui/Primitives";
import { matchesSearch, useFeed } from "@/components/tabs/useFeed";
import { Reel } from "@/components/reels/Reel";
import type { Post } from "@/types/cliq";
import { cx } from "@/lib/utils";

type FeedMode = "forYou" | "following";

/**
 * Vertical 9:16 Reels player.
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

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[620px] py-6">
        <SkeletonCard />
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[620px]">
        <EmptyState
          icon={<Film size={26} strokeWidth={1.75} />}
          title={
            search ? "No videos match that search" : mode === "following" ? "No videos from people you follow" : "No videos yet"
          }
          hint={
            search
              ? "Try a different search."
              : mode === "following"
                ? "Follow creators to see their videos here."
                : "Be the first to post a video."
          }
          actionLabel={mode === "forYou" && !search ? "Create a post" : undefined}
          onAction={mode === "forYou" && !search ? () => setCreateOpen(true) : undefined}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full justify-center py-4">
      <div className="relative aspect-[9/16] h-[calc(100dvh-9.5rem)] max-h-[840px] w-auto overflow-hidden rounded-xl border border-white/10 bg-[#0d0d10] md:h-[calc(100dvh-6rem)]">
        {/* Top overlay */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-3">
          <div className="pointer-events-auto flex gap-4">
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
                  "text-sm transition",
                  mode === key ? "font-semibold text-white" : "font-normal text-white/60 hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => setMuted((m) => !m)}
            className="pointer-events-auto grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
          >
            {muted ? <VolumeX size={17} strokeWidth={1.75} /> : <Volume2 size={17} strokeWidth={1.75} />}
          </button>
        </div>

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
