"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar, Skeleton } from "@/components/ui/Primitives";
import { api } from "@/lib/api-client";
import type { PublicUser, StoryGroup } from "@/types/cliq";
import { cx, timeAgo } from "@/lib/utils";

/**
 * Cliq Stories ring bar.
 *
 * The first ring is always the signed-in user's own story ("Your Story"); tapping
 * it opens the story creator when they have nothing live, or plays their story.
 * Tapping anyone else's ring opens the full-screen tap-through viewer.
 */
export function StoryBar({
  onOpenViewer,
  onCompose,
  inline = false,
}: {
  onOpenViewer: (groups: StoryGroup[], startIndex: number) => void;
  onCompose: () => void;
  /** Inline renders the rings as a bare row (no card chrome, tighter padding). */
  inline?: boolean;
}) {
  const { user, revision } = useCliq();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await api.listStories();
      setGroups(list);
    } catch {
      // Stories are non-critical; a failed load just shows the empty state.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user, load, revision]);

  if (!user) return null;

  const mineIndex = groups.findIndex((g) => g.author.id === user.id);
  const mine = mineIndex >= 0 ? groups[mineIndex] : null;
  // "My Story" first, then everyone else newest-first.
  const ordered = mine ? [mine, ...groups.filter((_, i) => i !== mineIndex)] : groups;

  return (
    <div
      className={
        inline
          ? "no-scrollbar flex shrink-0 items-center gap-3.5 overflow-x-auto"
          : "no-scrollbar flex gap-3.5 overflow-x-auto px-1 py-3"
      }
    >
      {/* Your own story ring */}
      <StoryRing
        label="Your Story"
        user={user}
        mine
        hasStory={Boolean(mine)}
        viewed={mine?.viewed ?? false}
        onOpen={() => {
          if (mine) onOpenViewer(ordered, 0);
          else onCompose();
        }}
        onAdd={onCompose}
      />

      {loading
        ? [0, 1, 2].map((i) => (
            <div key={i} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
              <Skeleton className="h-[62px] w-[62px] rounded-full" />
              <Skeleton className="h-2.5 w-12" />
            </div>
          ))
        : ordered
            .filter((g) => g.author.id !== user.id)
            .map((group) => (
              <StoryRing
                key={group.author.id}
                label={`@${group.author.username}`}
                user={group.author}
                viewed={group.viewed}
                count={group.stories.length}
                ago={timeAgo(group.stories[group.stories.length - 1]?.createdAt ?? new Date().toISOString())}
                onOpen={() => {
                  const start = ordered.findIndex((g) => g.author.id === group.author.id);
                  onOpenViewer(ordered, start);
                }}
              />
            ))}

      {!loading && groups.length <= 1 ? (
        <div className="flex items-center pr-2 text-[11px] leading-tight text-zinc-600">
          Friends&apos; stories appear
          <br />
          here for 24 hours.
        </div>
      ) : null}
    </div>
  );
}

function StoryRing({
  label,
  user,
  mine,
  hasStory,
  viewed,
  count,
  ago,
  onOpen,
  onAdd,
}: {
  label: string;
  user: Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl">;
  mine?: boolean;
  hasStory?: boolean;
  viewed: boolean;
  count?: number;
  ago?: string;
  onOpen: () => void;
  onAdd?: () => void;
}) {
  const ringClass = mine
    ? hasStory
      ? "bg-gradient-to-tr from-indigo-500 to-violet-400 p-[2.5px]"
      : "border-2 border-dashed border-zinc-700"
    : viewed
      ? "bg-zinc-700 p-[2.5px]"
      : "bg-gradient-to-tr from-indigo-500 via-violet-500 to-rose-500 p-[2.5px]";

  return (
    <div className="flex w-[72px] shrink-0 flex-col items-center gap-1.5">
      <button type="button" onClick={onOpen} className="relative transition active:scale-95" aria-label={label}>
        <span className={cx("grid h-[64px] w-[64px] place-items-center rounded-full", ringClass)}>
          <span className="grid h-full w-full place-items-center rounded-full bg-[#09090b] p-[2px]">
            <Avatar user={user} size={54} />
          </span>
        </span>
        {mine ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Add to your story"
            onClick={(e) => {
              e.stopPropagation();
              onAdd?.();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                onAdd?.();
              }
            }}
            className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-[#09090b] bg-indigo-600 text-white transition hover:bg-indigo-500"
          >
            <Plus size={13} strokeWidth={3} />
          </span>
        ) : count && count > 1 ? (
          <span className="absolute -bottom-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full border-2 border-[#09090b] bg-zinc-800 px-1 text-[10px] font-bold text-zinc-200">
            {count}
          </span>
        ) : null}
      </button>
      <span className="max-w-full truncate text-[10px] font-semibold text-zinc-400">{label}</span>
      {ago ? <span className="text-[9px] text-zinc-600">{ago}</span> : null}
    </div>
  );
}
