"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Hash, Search, User } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { swrFetcher } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Primitives";
import { feedKey } from "@/components/tabs/useFeed";
import type { Post, PublicUser, TabKey } from "@/types/cliq";

/**
 * Live global search dropdown.
 *
 * Matches users, #hashtags and post text across every feed, reusing the SWR
 * caches the tabs already populate (so it costs no extra requests) plus one
 * user query.
 */
export function SearchDropdown({
  query,
  onClose,
  onOpenProfile,
  onSearch,
}: {
  query: string;
  onClose: () => void;
  onOpenProfile: (id: string) => void;
  /** Applies a hashtag search and keeps the query in sync with the header. */
  onSearch: (value: string) => void;
}) {
  const { setTab } = useCliq();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [debounced, setDebounced] = useState(query);

  // Debounce so we are not filtering on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  const { data: users } = useSWR<{ users: PublicUser[] }>(["/api/users", undefined], swrFetcher, {
    revalidateOnFocus: false,
  });
  const { data: videoFeed } = useSWR<{ posts: Post[] }>(feedKey("video"), swrFetcher, { revalidateOnFocus: false });
  const { data: photoFeed } = useSWR<{ posts: Post[] }>(feedKey("photo"), swrFetcher, { revalidateOnFocus: false });
  const { data: chatFeed } = useSWR<{ posts: Post[] }>(feedKey("chat"), swrFetcher, { revalidateOnFocus: false });

  const term = debounced.trim().toLowerCase().replace(/^#/, "");

  const results = useMemo(() => {
    if (term.length < 1) return { users: [], hashtags: [], posts: [] };

    const matchedUsers = (users?.users ?? [])
      .filter((u) => u.username.toLowerCase().includes(term) || u.displayName.toLowerCase().includes(term))
      .slice(0, 4);

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
      .slice(0, 4);

    return {
      users: matchedUsers,
      hashtags: [...hashtags.entries()].slice(0, 5),
      posts: matchedPosts,
    };
  }, [term, users, videoFeed, photoFeed, chatFeed]);

  const empty =
    results.users.length === 0 && results.hashtags.length === 0 && results.posts.length === 0;

  if (term.length < 1) return null;

  function goToTab(tab: TabKey) {
    setTab(tab);
    onClose();
  }

  return (
    <div
      ref={wrapRef}
      data-testid="search-dropdown"
      className="cliq-pop absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl border border-zinc-800/80 bg-[#121317]/95 shadow-2xl backdrop-blur-xl"
    >
      {empty ? (
        <p className="px-4 py-6 text-center text-xs text-zinc-500">No matches for “{debounced}”.</p>
      ) : (
        <div className="cliq-scroll max-h-[26rem] overflow-y-auto p-2">
          {results.users.length > 0 ? (
            <>
              <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">People</p>
              {results.users.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => {
                    onOpenProfile(person.id);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-zinc-800/60"
                >
                  <Avatar user={person} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-zinc-100">{person.displayName}</span>
                    <span className="block truncate text-[11px] text-zinc-500">@{person.username}</span>
                  </span>
                  <User size={13} className="shrink-0 text-zinc-600" />
                </button>
              ))}
            </>
          ) : null}

          {results.hashtags.length > 0 ? (
            <>
              <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Hashtags</p>
              {results.hashtags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    onSearch(`#${tag}`);
                    goToTab("chatposts");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-zinc-800/60"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-600/15 text-indigo-400">
                    <Hash size={14} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-zinc-100">#{tag}</span>
                  <span className="shrink-0 text-[10px] text-zinc-500">{count} posts</span>
                </button>
              ))}
            </>
          ) : null}

          {results.posts.length > 0 ? (
            <>
              <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Posts</p>
              {results.posts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() =>
                    goToTab(post.type === "video" ? "videos" : post.type === "photo" ? "photos" : "chatposts")
                  }
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-zinc-800/60"
                >
                  {post.mediaUrl && post.type !== "chat" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.mediaUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-zinc-800 text-[10px]">
                      💬
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-zinc-200">{post.content || "Post"}</span>
                    <span className="block truncate text-[10px] text-zinc-500">
                      @{post.author?.username ?? "unknown"} · {post.type}
                    </span>
                  </span>
                </button>
              ))}
            </>
          ) : null}
        </div>
      )}

      <div className="flex items-center gap-1.5 border-t border-zinc-800/80 px-3 py-2">
        <Search size={12} className="text-zinc-600" />
        <p className="text-[10px] text-zinc-500">Search across people, hashtags and posts</p>
      </div>
    </div>
  );
}
