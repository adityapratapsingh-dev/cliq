"use client";

import { useEffect, useState } from "react";
import { Check, Heart, MessageCircle, MessageSquare, UserPlus, X, Zap } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar, Spinner } from "@/components/ui/Primitives";
import { api } from "@/lib/api-client";
import { useNotifications } from "@/components/tabs/useFeed";
import type { FriendGraph } from "@/types/cliq";
import { cx, timeAgo } from "@/lib/utils";

/**
 * The bell drawer. Shows real notifications from the `notifications` table
 * (likes, upgrades, comments, messages) with pending Cliq Up requests pinned to
 * the top because they need an answer.
 */
export function NotificationDrawer({ onClose, onOpenChats }: { onClose: () => void; onOpenChats: () => void }) {
  const { apiError, setTab, toast } = useCliq();
  const { data, isLoading, mutate } = useNotifications();
  const [graph, setGraph] = useState<FriendGraph | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    api
      .getFriends()
      .then(setGraph)
      .catch(() => undefined);
  }, []);

  async function respond(id: string, accept: boolean) {
    setBusyId(id);
    try {
      const updated = await api.respondFriend(id, accept);
      setGraph(updated);
      await mutate();
      toast(accept ? "Cliq Up accepted ⚡" : "Request declined", accept ? "success" : "default");
    } catch (error) {
      apiError(error);
    } finally {
      setBusyId(null);
    }
  }

  const notifications = data?.notifications ?? [];
  const unread = data?.unread ?? 0;
  const incoming = graph?.incoming ?? [];

  const iconFor = (kind: string) => {
    switch (kind) {
      case "like":
        return <Heart size={14} className="text-rose-400" />;
      case "upgrade":
        return <Zap size={14} className="text-emerald-400" />;
      case "comment":
        return <MessageCircle size={14} className="text-cyan-400" />;
      case "cliqup":
        return <UserPlus size={14} className="text-[var(--accent-2)]" />;
      default:
        return <MessageSquare size={14} className="text-violet-400" />;
    }
  };

  return (
    <div
      className="cliq-pop fixed right-3 top-[4.25rem] z-50 w-[min(92vw,22rem)] overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/95 shadow-2xl backdrop-blur-xl sm:right-5"
      data-testid="notification-drawer"
    >
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
        <p className="text-sm font-bold text-zinc-100">Notifications</p>
        <div className="flex items-center gap-2">
          {unread > 0 ? (
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-2)]">
              {unread} new
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="text-zinc-500 hover:text-zinc-200"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="cliq-scroll max-h-[60vh] overflow-y-auto p-2">
        {/* Pending Cliq Up requests are actionable, so they come first. */}
        {incoming.map((request) => (
          <div key={request.id} className="mb-1 flex items-start gap-3 rounded-2xl bg-[var(--accent-soft)] p-3">
            <Avatar user={request.user} size={36} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                <UserPlus size={13} className="text-[var(--accent-2)]" />
                <span className="truncate">{request.user.displayName}</span>
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">sent you a Cliq Up request ⚡</p>
              <p className="mt-0.5 text-[10px] text-zinc-600">{timeAgo(request.createdAt)}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => void respond(request.id, true)}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-grad)] px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                >
                  <Check size={12} /> Accept
                </button>
                <button
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => void respond(request.id, false)}
                  className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        ))}

        {isLoading && notifications.length === 0 ? (
          <p className="flex items-center gap-2 px-3 py-6 text-xs text-zinc-500">
            <Spinner /> Loading...
          </p>
        ) : notifications.length === 0 && incoming.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-zinc-500">
            You&apos;re all caught up ✨
            <br />
            New likes, comments and Cliq Ups will land here.
          </p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                if (n.kind === "message") {
                  setTab("friends");
                  onOpenChats();
                } else if (n.postId) {
                  setTab(n.kind === "comment" ? "chatposts" : "photos");
                }
                onClose();
              }}
              className={cx(
                "flex w-full items-start gap-3 rounded-2xl p-3 text-left transition hover:bg-zinc-800/50",
                !n.isRead && "bg-[var(--accent-soft)]",
              )}
            >
              {n.actor ? <Avatar user={n.actor} size={36} /> : <span className="h-9 w-9 rounded-full bg-zinc-800" />}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                  {iconFor(n.kind)}
                  <span className="truncate">{n.actor?.displayName ?? "Someone"}</span>
                </span>
                <span className="mt-0.5 block text-xs text-zinc-400">{n.text}</span>
                <span className="mt-0.5 block text-[10px] text-zinc-600">{timeAgo(n.createdAt)}</span>
              </span>
            </button>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setTab("friends");
          onOpenChats();
          onClose();
        }}
        className="inline-flex w-full items-center justify-center gap-1.5 border-t border-zinc-800/80 px-4 py-3 text-xs font-semibold text-[var(--accent-2)] transition hover:bg-zinc-800/60"
      >
        <Zap size={13} /> Open Chats &amp; Friends
      </button>
    </div>
  );
}
