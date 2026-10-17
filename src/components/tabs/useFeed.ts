"use client";

import { useCallback, useMemo } from "react";
import useSWR, { mutate as globalMutate, type KeyedMutator } from "swr";
import { api, swrFetcher } from "@/lib/api-client";
import { useCliq } from "@/components/CliqProvider";
import type { Comment, ConversationSummary, Message, Post, PostType, ProfileStats } from "@/types/cliq";

/** Cache keys, kept in one place so mutations and reads always agree. */
export const feedKey = (type: PostType) => `/api/posts?type=${type}`;
export const commentsKey = (postId: string) => `/api/comments?postId=${encodeURIComponent(postId)}`;
export const conversationsKey = "/api/messages";
export const threadKey = (partnerId: string) => `/api/messages?with=${encodeURIComponent(partnerId)}`;
export const statsKey = "/api/stats";
export const notificationsKey = "/api/notifications";

/* ------------------------------------------------------------------ helpers */

function sortNewestFirst(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* -------------------------------------------------------------------- feeds */

interface UseFeedResult {
  posts: Post[];
  /** true only on the very first load, so cached data renders instantly. */
  loading: boolean;
  isValidating: boolean;
  reload: () => Promise<void>;
  replacePost: (post: Post) => void;
  removePost: (id: string) => void;
  mutate: KeyedMutator<{ posts: Post[] }>;
}

/**
 * SWR-backed feed.
 *
 * Cached posts render immediately (no spinner) while a background revalidation
 * fetches fresh data. Mutations update the cache optimistically so interactions
 * feel instant.
 */
export function useFeed(type: PostType): UseFeedResult {
  const key = feedKey(type);
  const { data, isLoading, isValidating, mutate } = useSWR<{ posts: Post[] }>(key, swrFetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const posts = useMemo(() => data?.posts ?? [], [data]);

  const reload = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const replacePost = useCallback(
    (post: Post) => {
      void mutate(
        (current) => ({
          posts: (current?.posts ?? []).map((p) => (p.id === post.id ? post : p)),
        }),
        { revalidate: false },
      );
    },
    [mutate],
  );

  const removePost = useCallback(
    (id: string) => {
      void mutate(
        (current) => ({ posts: (current?.posts ?? []).filter((p) => p.id !== id) }),
        { revalidate: false },
      );
    },
    [mutate],
  );

  return {
    posts,
    loading: isLoading && !data,
    isValidating,
    reload,
    replacePost,
    removePost,
    mutate,
  };
}

/* ----------------------------------------------------------------- comments */

interface UseCommentsResult {
  comments: Comment[];
  loading: boolean;
  add: (text: string, parentId?: string | null) => Promise<void>;
  mutate: KeyedMutator<{ comments: Comment[] }>;
}

/** Comment tree for one post, loaded on demand and cached. */
export function useComments(postId: string, enabled: boolean): UseCommentsResult {
  const key = enabled && postId ? commentsKey(postId) : null;
  const { data, isLoading, mutate } = useSWR<{ comments: Comment[] }>(key, swrFetcher, {
    revalidateOnFocus: false,
  });

  const add = useCallback(
    async (text: string, parentId?: string | null) => {
      if (!text.trim()) return;
      await api.addComment(postId, text, parentId ?? null);
      await mutate();
      // The feed shows a comment count, so refresh it too.
      await globalMutate((k) => typeof k === "string" && k.startsWith("/api/posts?"));
    },
    [postId, mutate],
  );

  return { comments: data?.comments ?? [], loading: isLoading, add, mutate };
}

/* ----------------------------------------------------------------- messages */

export function useConversations() {
  return useSWR<{ conversations: ConversationSummary[] }>(conversationsKey, swrFetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

export function useThread(partnerId: string | null) {
  return useSWR<{ messages: Message[] }>(partnerId ? threadKey(partnerId) : null, swrFetcher, {
    refreshInterval: partnerId ? 3000 : 0,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

/* -------------------------------------------------------------------- stats */

export function useStats() {
  return useSWR<ProfileStats>(statsKey, swrFetcher, { revalidateOnFocus: false });
}

export function useNotifications(enabled = true) {
  return useSWR<{ notifications: import("@/types/cliq").CliqNotification[]; unread: number }>(
    enabled ? notificationsKey : null,
    swrFetcher,
    { refreshInterval: 15000, revalidateOnFocus: false },
  );
}

/* ------------------------------------------------------------------- search */

export function matchesSearch(post: Post, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().replace("#", "");
  return (
    post.content.toLowerCase().includes(q) ||
    (post.flair ?? "").toLowerCase().includes(q) ||
    (post.author?.username ?? "").toLowerCase().includes(q) ||
    (post.author?.displayName ?? "").toLowerCase().includes(q)
  );
}

/**
 * Optimistically prepend a freshly created post to a feed cache, then
 * revalidate in the background.
 */
export async function prependPost(type: PostType, post: Post) {
  const key = feedKey(type);
  await globalMutate(
    key,
    (current: { posts: Post[] } | undefined) => ({
      posts: sortNewestFirst([post, ...(current?.posts ?? [])]),
    }),
    { revalidate: true },
  );
}

export { useCliq };
