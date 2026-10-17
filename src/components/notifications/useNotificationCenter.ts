"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { api, swrFetcher } from "@/lib/api-client";
import type { CliqNotification, NotificationsResponse, UnreadCounts } from "@/types/cliq";

export const NOTIFICATIONS_KEY = "/api/notifications";
/** How often the bell, badges and toasts refresh. */
export const POLL_MS = 4000;

const EMPTY_COUNTS: UnreadCounts = { notifications: 0, messages: 0, pendingRequests: 0 };

/**
 * Live notification state.
 *
 * Polls every 4s, exposes the counters that drive every red dot, and reports
 * genuinely-new notifications (arrived after the first load) so the app can show
 * an in-app banner without re-announcing history on every page load.
 */
export function useNotificationCenter() {
  const { data, isLoading, mutate } = useSWR<NotificationsResponse>(NOTIFICATIONS_KEY, swrFetcher, {
    refreshInterval: POLL_MS,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  // Ids we have already seen, so we only announce each notification once.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<CliqNotification[]>([]);

  useEffect(() => {
    if (!data) return;
    const ids = data.notifications.map((n) => n.id);

    if (seen.current === null) {
      // First load: remember history without announcing it.
      seen.current = new Set(ids);
      return;
    }

    const newOnes = data.notifications.filter((n) => !seen.current!.has(n.id) && !n.isRead);
    for (const id of ids) seen.current.add(id);
    if (newOnes.length > 0) setFresh(newOnes);
  }, [data]);

  /** Clear the "fresh" queue once the banner has shown them. */
  const consumeFresh = useCallback(() => setFresh([]), []);

  const counts = data?.counts ?? EMPTY_COUNTS;
  const notifications = data?.notifications ?? [];

  /**
   * Optimistically mark read, then reconcile.
   *
   * The badge must drop the instant you tap — waiting for the round-trip is
   * exactly the lag Instagram does not have.
   */
  const markRead = useCallback(
    async (id?: string) => {
      await mutate(
        (current) => {
          if (!current) return current;
          const wasUnread = id
            ? current.notifications.some((n) => n.id === id && !n.isRead)
            : current.counts.notifications > 0;
          const notifications = current.notifications.map((n) =>
            !id || n.id === id ? { ...n, isRead: true } : n,
          );
          const removed = id ? (wasUnread ? 1 : 0) : current.counts.notifications;
          return {
            ...current,
            notifications,
            counts: { ...current.counts, notifications: Math.max(0, current.counts.notifications - removed) },
          };
        },
        { revalidate: false },
      );
      try {
        await api.markNotificationsRead(id);
      } catch {
        // Revalidate below to resync if the write failed.
      }
      await mutate();
    },
    [mutate],
  );

  return {
    notifications,
    counts,
    breakdown: data?.breakdown ?? { like: 0, comment: 0, upgrade: 0, cliqp: 0 },
    isLoading,
    fresh,
    consumeFresh,
    markRead,
    refresh: mutate,
    unreadCount: counts.notifications,
  };
}

/** Fire-and-forget refresh of the badge counters after a local action. */
export function refreshNotifications() {
  return globalMutate(NOTIFICATIONS_KEY);
}
