"use client";

import { useCallback } from "react";
import { mutate as globalMutate } from "swr";
import { api } from "@/lib/api-client";
import { useCliq } from "@/components/CliqProvider";
import { commentsKey, feedKey } from "@/components/tabs/useFeed";
import type { Post, ReactionType } from "@/types/cliq";

/** Apply a local change to whichever feed cache holds this post. */
async function patchPostEverywhere(postId: string, updater: (post: Post) => Post) {
  await globalMutate(
    (key) => typeof key === "string" && key.startsWith("/api/posts?"),
    (current: { posts: Post[] } | undefined) => {
      if (!current?.posts) return current;
      return { posts: current.posts.map((p) => (p.id === postId ? updater(p) : p)) };
    },
    { revalidate: false },
  );
}

/**
 * Optimistic post interactions.
 *
 * Every action updates the SWR cache synchronously (0ms perceived delay), fires
 * the request, then reconciles with the server's authoritative counts.
 */
export function usePostActions() {
  const { apiError, toast } = useCliq();

  /** Like / dislike on photos & videos, or upgrade / downgrade on chat posts. */
  const react = useCallback(
    async (postId: string, reaction: ReactionType, current: Post) => {
      const isChat = current.type === "chat";
      const column =
        reaction === "like"
          ? "likesCount"
          : reaction === "dislike"
            ? "dislikesCount"
            : reaction === "upgrade"
              ? "upgradesCount"
              : "downgradesCount";

      const togglingOff = current.myReaction === reaction;

      // Opposite reaction for the mutual-exclusivity rule on photos/videos.
      const opposite =
        !isChat && reaction === "like"
          ? "dislike"
          : !isChat && reaction === "dislike"
            ? "like"
            : null;

      const optimistic = (post: Post): Post => {
        const next: Post = { ...post };
        const delta = togglingOff ? -1 : 1;
        next[column] = Math.max(0, (post[column] as number) + delta);
        next.myReaction = togglingOff ? null : reaction;
        if (opposite && !togglingOff && post.myReaction === opposite) {
          const oppositeColumn =
            opposite === "like" ? "likesCount" : "dislikesCount";
          next[oppositeColumn] = Math.max(0, (post[oppositeColumn] as number) - 1);
        }
        return next;
      };

      await patchPostEverywhere(postId, optimistic);

      try {
        const { post } = await api.react(postId, reaction);
        // Reconcile with the server's counts (authoritative).
        await patchPostEverywhere(postId, () => post);
        return post;
      } catch (error) {
        await patchPostEverywhere(postId, () => current);
        apiError(error);
        return null;
      }
    },
    [apiError],
  );

  /** Poll vote, with immediate percentage feedback. */
  const votePoll = useCallback(
    async (postId: string, optionId: string, current: Post) => {
      if (!current.poll) return null;
      const previous = current.poll.votedOptionId;
      if (previous === optionId) return current;

      const optimistic: Post = {
        ...current,
        poll: {
          votedOptionId: optionId,
          options: current.poll.options.map((o) => {
            if (o.id === previous) return { ...o, votes: Math.max(0, o.votes - 1) };
            if (o.id === optionId) return { ...o, votes: o.votes + 1 };
            return o;
          }),
        },
      };

      await patchPostEverywhere(postId, () => optimistic);

      try {
        const { post } = await api.votePoll(postId, optionId);
        await patchPostEverywhere(postId, () => post);
        return post;
      } catch (error) {
        await patchPostEverywhere(postId, () => current);
        apiError(error);
        return null;
      }
    },
    [apiError],
  );

  /** Delete one of your own posts. */
  const remove = useCallback(
    async (postId: string) => {
      await globalMutate(
        (key) => typeof key === "string" && key.startsWith("/api/posts?"),
        (current: { posts: Post[] } | undefined) =>
          current?.posts ? { posts: current.posts.filter((p) => p.id !== postId) } : current,
        { revalidate: false },
      );
      try {
        await api.deletePost(postId);
        toast("Post deleted", "default");
      } catch (error) {
        apiError(error);
        await globalMutate((key) => typeof key === "string" && key.startsWith("/api/posts?"));
      }
    },
    [apiError, toast],
  );

  /** Add a comment optimistically so it appears the instant you hit send. */
  const comment = useCallback(
    async (postId: string, text: string, parentId: string | null, author: { id: string; username: string; displayName: string; avatarUrl: string | null; age: number | null; bio: string; bannerUrl: string | null; interests: string[]; createdAt: string }) => {
      if (!text.trim()) return;
      const key = commentsKey(postId);

      const optimisticComment = {
        id: `optimistic_${Date.now()}`,
        postId,
        userId: author.id,
        author,
        parentCommentId: parentId,
        content: text.trim(),
        createdAt: new Date().toISOString(),
        replies: [],
      };

      await globalMutate(
        key,
        (current: { comments: import("@/types/cliq").Comment[] } | undefined) => {
          const list = current?.comments ?? [];
          if (!parentId) return { comments: [...list, optimisticComment] };
          const insert = (comments: import("@/types/cliq").Comment[]): import("@/types/cliq").Comment[] =>
            comments.map((c) =>
              c.id === parentId
                ? { ...c, replies: [...c.replies, optimisticComment] }
                : { ...c, replies: insert(c.replies) },
            );
          return { comments: insert(list) };
        },
        { revalidate: false },
      );

      try {
        await api.addComment(postId, text, parentId);
        await globalMutate(key);
        await globalMutate((k) => typeof k === "string" && k.startsWith("/api/posts?"));
      } catch (error) {
        apiError(error);
        await globalMutate(key);
      }
    },
    [apiError],
  );

  /** Replace a post everywhere it is cached (used after edit / pin). */
  const replacePost = useCallback(async (post: Post) => {
    await patchPostEverywhere(post.id, () => post);
  }, []);

  return { react, votePoll, remove, comment, replacePost, feedKey };
}
