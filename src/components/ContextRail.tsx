"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { MessageSquare, Search, TrendingUp } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { swrFetcher } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Primitives";
import { FLAIRS } from "@/lib/constants";
import { feedKey } from "@/components/tabs/useFeed";
import type { Post, PublicUser } from "@/types/cliq";
import { cx } from "@/lib/utils";

/**
 * Right contextual sidebar (`xl` and up).
 *
 * Three stacked cards: people to cliq with, trending topics (which filter the
 * feed), and quick-access friends to jump straight into a DM.
 */
export function RightSidebar({
  onOpenProfile,
  onOpenSearch,
}: {
  onOpenProfile: (id: string) => void;
  onOpenSearch: () => void;
}) {
  const { user, followingIds, toggleFollow, openChat, setSearch } = useCliq();

  const { data } = useSWR<{ users: PublicUser[] }>(user ? ["/api/users", undefined] : null, swrFetcher, {
    revalidateOnFocus: false,
  });
  const { data: chatData } = useSWR<{ posts: Post[] }>(feedKey("chat"), swrFetcher, {
    revalidateOnFocus: false,
  });

  const people = useMemo(() => {
    const mine = new Set(user?.interests ?? []);
    return (data?.users ?? [])
      .filter((p) => p.id !== user?.id)
      .map((p) => ({ person: p, shared: p.interests.filter((i) => mine.has(i)).length }))
      .sort((a, b) => b.shared - a.shared || a.person.username.localeCompare(b.person.username))
      .slice(0, 4);
  }, [data, user]);

  // Live flair counts, derived from the chat feed.
  const trends = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of chatData?.posts ?? []) {
      if (post.flair) counts.set(post.flair, (counts.get(post.flair) ?? 0) + 1);
    }
    return FLAIRS.map((f) => ({ label: f.label, count: counts.get(f.label) ?? 0 })).sort(
      (a, b) => b.count - a.count,
    );
  }, [chatData]);

  // Friends you can message right now (mutual follows).
  const friends = useMemo(
    () => (data?.users ?? []).filter((p) => p.id !== user?.id && followingIds.includes(p.id)).slice(0, 8),
    [data, user, followingIds],
  );

  return (
    <aside className="hidden w-[320px] shrink-0 flex-col gap-4 px-6 pt-6 xl:flex">
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex w-full items-center gap-2 rounded-full border border-zinc-800/80 bg-[#121317] px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-700"
      >
        <Search size={16} strokeWidth={1.75} />
        <span>Search</span>
      </button>

      {/* People to Cliq With */}
      <section className="rounded-2xl border border-zinc-800/80 bg-[#121317] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">People to Cliq With</h2>
          <button
            type="button"
            onClick={onOpenSearch}
            className="text-xs font-semibold text-zinc-500 transition hover:text-zinc-200"
          >
            See all
          </button>
        </div>
        <ul className="mt-3">
          {people.length === 0 ? (
            <li className="py-3 text-xs text-zinc-500">No suggestions yet — invite a friend to Cliq.</li>
          ) : (
            people.map(({ person, shared }) => {
              const following = followingIds.includes(person.id);
              return (
                <li key={person.id} className="flex items-center gap-3 py-2">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(person.id)}
                    className="shrink-0 rounded-full transition hover:opacity-90"
                    aria-label={`Open ${person.displayName}'s profile`}
                  >
                    <Avatar user={person} size={40} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenProfile(person.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-semibold text-zinc-100">{person.username}</span>
                    <span className="block truncate text-[11px] text-zinc-500">
                      {shared > 0 ? `${shared} shared interest${shared > 1 ? "s" : ""}` : person.displayName}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFollow(person.id)}
                    className={cx(
                      "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition",
                      following
                        ? "border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                        : "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-500",
                    )}
                  >
                    {following ? "Following" : "Cliq Up"}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </section>

      {/* Trending on Cliq */}
      <section className="rounded-2xl border border-zinc-800/80 bg-[#121317] p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <TrendingUp size={15} strokeWidth={2} className="text-indigo-400" /> Trending on Cliq
        </h2>
        <ul className="mt-2">
          {trends.map((trend) => (
            <li key={trend.label}>
              <button
                type="button"
                onClick={() => setSearch(trend.label)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition hover:bg-zinc-800/60"
              >
                <span className="text-sm font-semibold text-zinc-200">{trend.label}</span>
                <span className="text-[11px] tabular-nums text-zinc-500">
                  {trend.count} {trend.count === 1 ? "post" : "posts"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Online in Your Cliq */}
      <section className="rounded-2xl border border-zinc-800/80 bg-[#121317] p-4">
        <h2 className="text-sm font-semibold text-zinc-100">Online in Your Cliq</h2>
        {friends.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">Follow people to see them here for quick chats.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-3">
            {friends.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => openChat(person)}
                title={`Message @${person.username}`}
                className="group flex flex-col items-center gap-1"
              >
                <span className="relative">
                  <Avatar user={person} size={44} online />
                  <span className="absolute -bottom-1 left-1/2 hidden -translate-x-1/2 items-center gap-0.5 rounded-full bg-zinc-900 px-1.5 py-0.5 text-[9px] font-bold text-zinc-200 ring-1 ring-zinc-700 group-hover:flex">
                    <MessageSquare size={9} /> DM
                  </span>
                </span>
                <span className="w-12 truncate text-center text-[10px] text-zinc-500">{person.username}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <p className="px-1 text-[11px] leading-relaxed text-zinc-600">
        About · Help · Press · API · Jobs · Privacy · Terms
      </p>
      <p className="px-1 pb-6 text-[11px] text-zinc-600">© 2026 Cliq</p>
    </aside>
  );
}
