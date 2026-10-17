"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Check, Flame, MessageCircle, UserPlus } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { swrFetcher } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Primitives";
import { FLAIRS } from "@/lib/constants";
import { conversationsKey, feedKey } from "@/components/tabs/useFeed";
import type { ConversationSummary, FriendGraph, Post, PublicUser } from "@/types/cliq";
import { cx } from "@/lib/utils";

/**
 * Right-hand contextual rail (xl and up).
 *
 * Three cards: people worth Cliq-ing, trending flairs with live counts, and
 * online friends for one-tap DMs. Hidden below `xl` so the centre column keeps
 * the full width on tablets.
 */
export function ContextRail({
  onOpenProfile,
  onOpenChats,
  onFilterFlair,
}: {
  onOpenProfile: (id: string) => void;
  onOpenChats: () => void;
  onFilterFlair: (flair: string) => void;
}) {
  const { user, followingIds, toggleFollow } = useCliq();

  const { data: people } = useSWR<{ users: PublicUser[] }>(
    user ? ["/api/users", undefined] : null,
    swrFetcher,
    { revalidateOnFocus: false },
  );
  const { data: chatFeed } = useSWR<{ posts: Post[] }>(user ? feedKey("chat") : null, swrFetcher, {
    revalidateOnFocus: false,
  });
  const { data: friends } = useSWR<FriendGraph>(user ? "/api/friends" : null, swrFetcher, {
    revalidateOnFocus: false,
  });
  const { data: conversations } = useSWR<{ conversations: ConversationSummary[] }>(
    user ? conversationsKey : null,
    swrFetcher,
    { revalidateOnFocus: false },
  );

  /** People sharing the most interests with the signed-in user. */
  const suggested = useMemo(() => {
    const mine = new Set(user?.interests ?? []);
    return (people?.users ?? [])
      .map((p) => ({ person: p, shared: p.interests.filter((i) => mine.has(i)).length }))
      .sort((a, b) => b.shared - a.shared || a.person.username.localeCompare(b.person.username))
      .slice(0, 4);
  }, [people, user]);

  /** Live post counts per flair. */
  const flairCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of chatFeed?.posts ?? []) {
      if (!post.flair) continue;
      counts.set(post.flair, (counts.get(post.flair) ?? 0) + 1);
    }
    return counts;
  }, [chatFeed]);

  const onlineFriends = useMemo(
    () => (friends?.friends ?? []).slice(0, 8),
    [friends],
  );

  const unreadByPartner = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of conversations?.conversations ?? []) map.set(c.partner.id, c.unreadCount);
    return map;
  }, [conversations]);

  return (
    <aside className="hidden w-80 shrink-0 flex-col gap-4 py-4 xl:flex">
      {/* People to Cliq With */}
      <section className="rounded-2xl border border-zinc-800/80 bg-[#121317] p-4">
        <header className="mb-3 flex items-center gap-2">
          <UserPlus size={14} className="text-[var(--accent-2)]" />
          <h2 className="text-sm font-bold text-zinc-100">People to Cliq With</h2>
        </header>
        {suggested.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-zinc-500">
            No suggestions yet — invite a friend to Cliq.
          </p>
        ) : (
          <ul className="space-y-1">
            {suggested.map(({ person, shared }) => {
              const following = followingIds.includes(person.id);
              return (
                <li key={person.id} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-zinc-800/50">
                  <button
                    type="button"
                    onClick={() => onOpenProfile(person.id)}
                    className="shrink-0 rounded-full transition hover:brightness-110"
                    aria-label={`Open ${person.displayName}'s profile`}
                  >
                    <Avatar user={person} size={38} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenProfile(person.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-xs font-bold text-zinc-100">{person.displayName}</span>
                    <span className="block truncate text-[11px] text-zinc-500">
                      @{person.username}
                      {shared > 0 ? ` · ${shared} shared` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFollow(person.id)}
                    aria-label={following ? "In Cliq" : "Cliq Up"}
                    className={cx(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-full transition",
                      following
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-indigo-600 text-white hover:bg-indigo-500",
                    )}
                  >
                    {following ? <Check size={14} strokeWidth={3} /> : <UserPlus size={14} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Trending on Cliq */}
      <section className="rounded-2xl border border-zinc-800/80 bg-[#121317] p-4">
        <header className="mb-3 flex items-center gap-2">
          <Flame size={14} className="text-orange-400" />
          <h2 className="text-sm font-bold text-zinc-100">Trending on Cliq</h2>
        </header>
        <ul className="space-y-1">
          {FLAIRS.map((flair) => (
            <li key={flair.label}>
              <button
                type="button"
                onClick={() => onFilterFlair(flair.label)}
                className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left transition hover:bg-zinc-800/50"
              >
                <span className="text-xs font-bold" style={{ color: flair.color }}>
                  {flair.label}
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-zinc-500">
                  {flairCounts.get(flair.label) ?? 0} posts
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Online in Your Cliq */}
      <section className="rounded-2xl border border-zinc-800/80 bg-[#121317] p-4">
        <header className="mb-3 flex items-center gap-2">
          <MessageCircle size={14} className="text-emerald-400" />
          <h2 className="text-sm font-bold text-zinc-100">Online in Your Cliq</h2>
        </header>
        {onlineFriends.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-zinc-500">
            No friends yet — Cliq Up someone above.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {onlineFriends.map((friend) => {
              const unread = unreadByPartner.get(friend.id) ?? 0;
              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={onOpenChats}
                  title={`Message @${friend.username}`}
                  className="relative rounded-full transition hover:brightness-110"
                >
                  <Avatar user={friend} size={40} />
                  {unread > 0 ? (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-lg shadow-rose-500/40">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={onOpenChats}
          className="mt-3 w-full rounded-xl border border-zinc-800 py-2 text-[11px] font-bold text-zinc-300 transition hover:border-indigo-500 hover:text-zinc-100"
        >
          Open Direct Chats
        </button>
      </section>
    </aside>
  );
}
