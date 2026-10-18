"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Clock, Hash, Search, TrendingUp, User, X } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { swrFetcher } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Primitives";
import { feedKey } from "@/components/tabs/useFeed";
import { FLAIRS } from "@/lib/constants";
import type { Post, PublicUser, TabKey } from "@/types/cliq";
import { cx } from "@/lib/utils";

const RECENT_KEY = "cliq:recent-searches";

/**
 * Global search panel.
 *
 * A command-palette style overlay: compact modal on desktop, full-screen on
 * mobile. Matches people, #hashtags and post text across every feed, and shows
 * recent searches, trending vibes and suggested people while the query is empty.
 */
export function SearchPanel({
  onClose,
  onOpenProfile,
}: {
  onClose: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const { setTab, setSearch, user, followingIds, toggleFollow } = useCliq();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    try {
      const stored = window.localStorage.getItem(RECENT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setRecent(parsed.filter((v): v is string => typeof v === "string").slice(0, 6));
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 160);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { data: users } = useSWR<{ users: PublicUser[] }>(["/api/users", undefined], swrFetcher, {
    revalidateOnFocus: false,
  });
  const { data: videoFeed } = useSWR<{ posts: Post[] }>(feedKey("video"), swrFetcher, { revalidateOnFocus: false });
  const { data: photoFeed } = useSWR<{ posts: Post[] }>(feedKey("photo"), swrFetcher, { revalidateOnFocus: false });
  const { data: chatFeed } = useSWR<{ posts: Post[] }>(feedKey("chat"), swrFetcher, { revalidateOnFocus: false });

  const term = debounced.trim().toLowerCase().replace(/^#/, "");

  const results = useMemo(() => {
    if (term.length < 1) return { users: [], hashtags: [] as [string, number][], posts: [] as Post[] };

    const matchedUsers = (users?.users ?? [])
      .filter((u) => u.username.toLowerCase().includes(term) || u.displayName.toLowerCase().includes(term))
      .slice(0, 6);

    const allPosts = [...(videoFeed?.posts ?? []), ...(photoFeed?.posts ?? []), ...(chatFeed?.posts ?? [])];

    const hashtags = new Map<string, number>();
    for (const post of allPosts) {
      for (const match of post.content.matchAll(/#([\p{L}\p{N}_]+)/gu)) {
        const tag = match[1];
        if (tag.toLowerCase().includes(term)) hashtags.set(tag, (hashtags.get(tag) ?? 0) + 1);
      }
      if (post.flair && post.flair.toLowerCase().replace("#", "").includes(term)) {
        const tag = post.flair.replace("#", "");
        hashtags.set(tag, (hashtags.get(tag) ?? 0) + 1);
      }
    }

    const matchedPosts = allPosts
      .filter((p) => p.content.toLowerCase().includes(term) || (p.flair ?? "").toLowerCase().includes(term))
      .slice(0, 6);

    return {
      users: matchedUsers,
      hashtags: [...hashtags.entries()].slice(0, 6),
      posts: matchedPosts,
    };
  }, [term, users, videoFeed, photoFeed, chatFeed]);

  const empty =
    term.length >= 1 &&
    results.users.length === 0 &&
    results.hashtags.length === 0 &&
    results.posts.length === 0;

  // Suggested people: everyone else, ranked by shared interests.
  const suggested = useMemo(() => {
    const mine = new Set(user?.interests ?? []);
    return (users?.users ?? [])
      .filter((p) => p.id !== user?.id)
      .map((p) => ({ person: p, shared: p.interests.filter((i) => mine.has(i)).length }))
      .sort((a, b) => b.shared - a.shared)
      .slice(0, 4);
  }, [users, user]);

  // Live trending counts derived from the chat feed.
  const trending = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of chatFeed?.posts ?? []) {
      if (post.flair) counts.set(post.flair, (counts.get(post.flair) ?? 0) + 1);
    }
    return FLAIRS.map((f) => ({ label: f.label, count: counts.get(f.label) ?? 0 })).sort((a, b) => b.count - a.count);
  }, [chatFeed]);

  function remember(value: string) {
    const next = [value, ...recent.filter((r) => r !== value)].slice(0, 6);
    setRecent(next);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable */
    }
  }

  function goToTab(tab: TabKey) {
    setTab(tab);
    onClose();
  }

  function goToHashtag(tag: string) {
    remember(`#${tag}`);
    setSearch(`#${tag}`);
    goToTab("chatposts");
  }

  return (
    <div className="fixed inset-0 z-[85] flex justify-center bg-black/70 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="cliq-pop flex h-full w-full flex-col overflow-hidden border-white/10 bg-[#0d0d10]/95 backdrop-blur-xl sm:h-auto sm:max-h-[80vh] sm:max-w-lg sm:rounded-2xl sm:border"
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search size={18} strokeWidth={1.75} className="text-zinc-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts, #hashtags, vibes..."
            className="min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <button type="button" onClick={onClose} aria-label="Close search" className="text-zinc-500 hover:text-zinc-200">
            <X size={18} />
          </button>
        </div>

        <div className="cliq-scroll min-h-0 flex-1 overflow-y-auto">
          {term.length < 1 ? (
            <div className="p-3">
              {recent.length > 0 ? (
                <section className="mb-2">
                  <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Recent</p>
                  <div className="flex flex-wrap gap-1.5 px-2">
                    {recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setQuery(r)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 transition hover:bg-white/10"
                      >
                        <Clock size={11} /> {r}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="mb-2">
                <p className="flex items-center gap-1.5 px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <TrendingUp size={12} /> Trending vibes
                </p>
                <div className="flex flex-wrap gap-1.5 px-2">
                  {trending.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => goToHashtag(t.label.replace("#", ""))}
                      className="inline-flex items-center gap-1 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/20"
                    >
                      {t.label}
                      <span className="text-[10px] text-indigo-300/70">{t.count}</span>
                    </button>
                  ))}
                </div>
              </section>

              {suggested.length > 0 ? (
                <section>
                  <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Suggested people
                  </p>
                  {suggested.map(({ person, shared }) => {
                    const following = followingIds.includes(person.id);
                    return (
                      <div key={person.id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-zinc-900">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenProfile(person.id);
                            onClose();
                          }}
                          className="shrink-0 rounded-full"
                        >
                          <Avatar user={person} size={40} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenProfile(person.id);
                            onClose();
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-sm font-semibold text-white">@{person.username}</span>
                          <span className="block truncate text-xs text-zinc-500">
                            {shared > 0 ? `${shared} shared interest${shared > 1 ? "s" : ""}` : person.displayName}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFollow(person.id)}
                          className={cx(
                            "shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition",
                            following
                              ? "border border-white/10 text-zinc-400 hover:text-zinc-200"
                              : "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-500",
                          )}
                        >
                          {following ? "Following" : "Cliq Up"}
                        </button>
                      </div>
                    );
                  })}
                </section>
              ) : (
                <p className="px-4 py-6 text-center text-sm text-zinc-500">
                  Search for people, #hashtags and posts.
                </p>
              )}
            </div>
          ) : empty ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-500">No matches for “{debounced}”.</p>
          ) : (
            <div className="p-2">
              {results.users.length > 0 ? (
                <>
                  <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">People</p>
                  {results.users.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => {
                        remember(`@${person.username}`);
                        onOpenProfile(person.id);
                        onClose();
                      }}
                      className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition hover:bg-zinc-900"
                    >
                      <Avatar user={person} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">@{person.username}</span>
                        <span className="block truncate text-xs text-zinc-500">{person.displayName}</span>
                      </span>
                      <User size={14} strokeWidth={1.75} className="shrink-0 text-zinc-600" />
                    </button>
                  ))}
                </>
              ) : null}

              {results.hashtags.length > 0 ? (
                <>
                  <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Hashtags</p>
                  {results.hashtags.map(([tag, count]) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => goToHashtag(tag)}
                      className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition hover:bg-zinc-900"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-zinc-400">
                        <Hash size={16} strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">#{tag}</span>
                      <span className="shrink-0 text-xs text-zinc-500">{count} posts</span>
                    </button>
                  ))}
                </>
              ) : null}

              {results.posts.length > 0 ? (
                <>
                  <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Posts</p>
                  {results.posts.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() =>
                        goToTab(post.type === "video" ? "videos" : post.type === "photo" ? "photos" : "chatposts")
                      }
                      className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition hover:bg-zinc-900"
                    >
                      {post.mediaUrl && post.type !== "chat" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.mediaUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                      ) : (
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/10 text-zinc-500">
                          <User size={16} strokeWidth={1.75} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-zinc-200">{post.content || "Post"}</span>
                        <span className="block truncate text-xs text-zinc-500">
                          @{post.author?.username ?? "unknown"} · {post.type}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
