"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Hash, Search, User, X } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { swrFetcher } from "@/lib/api-client";
import { Avatar } from "@/components/ui/Primitives";
import { feedKey } from "@/components/tabs/useFeed";
import type { Post, PublicUser, TabKey } from "@/types/cliq";

/**
 * Global search panel.
 *
 * A full-width overlay opened from the rail / bottom bar. Matches people,
 * #hashtags and post text across every feed, reusing the SWR caches the tabs
 * already populate plus one user query.
 */
export function SearchPanel({
  onClose,
  onOpenProfile,
}: {
  onClose: () => void;
  onOpenProfile: (id: string) => void;
}) {
  const { setTab, setSearch } = useCliq();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
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

  function goToTab(tab: TabKey) {
    setTab(tab);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[85] flex justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="cliq-pop mt-0 h-full w-full max-w-[560px] overflow-hidden border-x border-zinc-800/80 bg-[#121317]/80 backdrop-blur-xl sm:mt-8 sm:h-auto sm:max-h-[80vh] sm:rounded-2xl sm:border"
      >
        <div className="flex items-center gap-3 border-b border-zinc-800/80 px-4 py-3">
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

        <div className="cliq-scroll max-h-[calc(100vh-4rem)] overflow-y-auto sm:max-h-[70vh]">
          {term.length < 1 ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-500">Search for people, #hashtags and posts.</p>
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
                      onClick={() => {
                        setSearch(`#${tag}`);
                        goToTab("chatposts");
                      }}
                      className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition hover:bg-zinc-900"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-zinc-800/80 text-zinc-400">
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
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-zinc-800/80 text-zinc-500">
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
