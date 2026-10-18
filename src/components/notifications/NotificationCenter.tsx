"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  BellRing,
  Heart,
  MessageCircle,
  MessageSquare,
  Rocket,
  UserPlus,
  X,
} from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar, Spinner } from "@/components/ui/Primitives";
import { useNotificationCenter } from "@/components/notifications/useNotificationCenter";
import { enableBrowserNotifications, browserNotificationsEnabled } from "@/lib/browser-notify";
import type { CliqNotification, NotificationKind, TabKey } from "@/types/cliq";
import { cx, relativeTime } from "@/lib/utils";

type Filter = "all" | "likes" | "comments" | "cliqs";

/** Maps a notification kind onto its badge icon + colour. */
function badgeFor(kind: NotificationKind) {
  switch (kind) {
    case "like":
      return { icon: <Heart size={11} className="fill-current" />, className: "bg-[#ff3040]" };
    case "dislike":
      return { icon: <Heart size={11} className="fill-current" />, className: "bg-[#f59e0b]" };
    case "upgrade":
      return { icon: <Rocket size={11} />, className: "bg-[#10b981]" };
    case "downgrade":
      return { icon: <Rocket size={11} className="rotate-180" />, className: "bg-[#f59e0b]" };
    case "comment":
    case "reply":
      return { icon: <MessageCircle size={11} />, className: "bg-[#4f46e5]" };
    case "friend_request":
    case "friend_accept":
    case "cliqup":
      return { icon: <UserPlus size={11} />, className: "bg-[#4f46e5]" };
    default:
      return { icon: <MessageSquare size={11} />, className: "bg-zinc-600" };
  }
}

function matchesFilter(n: CliqNotification, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "likes") return ["like", "dislike", "upgrade", "downgrade", "poll_vote"].includes(n.kind);
  if (filter === "comments") return ["comment", "reply"].includes(n.kind);
  return ["friend_request", "friend_accept", "cliqup"].includes(n.kind);
}

/** Buckets a notification into New / Today / Earlier. */
function bucketOf(n: CliqNotification, now: number): "new" | "today" | "earlier" {
  if (!n.isRead) return "new";
  const then = new Date(n.createdAt).getTime();
  if (Number.isNaN(then)) return "earlier";
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  return then >= startOfToday ? "today" : "earlier";
}

/**
 * Slide-out Notifications panel.
 *
 * Right-hand drawer on desktop, full-screen sheet on mobile. Filterable and
 * grouped, with inline "Follow back" for Cliq requests.
 */
export function NotificationCenter({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (tab: TabKey) => void;
}) {
  const { setTab, apiError, toast } = useCliq();
  const { notifications, counts, isLoading, markRead, refresh } = useNotificationCenter();
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pushOn, setPushOn] = useState(() => browserNotificationsEnabled());

  const now = Date.now();
  const filtered = useMemo(() => notifications.filter((n) => matchesFilter(n, filter)), [notifications, filter]);

  const groups = useMemo(() => {
    const buckets: Record<"new" | "today" | "earlier", CliqNotification[]> = { new: [], today: [], earlier: [] };
    for (const n of filtered) buckets[bucketOf(n, now)].push(n);
    return buckets;
  }, [filtered, now]);

  async function openNotification(n: CliqNotification) {
    setBusyId(n.id);
    void markRead(n.id);
    try {
      if (n.kind === "message") setTab("friends");
      else if (n.post?.type === "video") setTab("videos");
      else if (n.post?.type === "photo") setTab("photos");
      else if (n.post?.type === "chat") setTab("chatposts");
      else if (["friend_request", "friend_accept", "cliqup"].includes(n.kind)) setTab("friends");
      onNavigate(n.kind === "message" ? "friends" : "chatposts");
      onClose();
    } catch (error) {
      apiError(error);
    } finally {
      setBusyId(null);
    }
  }

  /** Follow a Cliq request straight from the row. */
  async function cliqBack(n: CliqNotification) {
    if (!n.actor) return;
    setBusyId(n.id);
    try {
      await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", userId: n.actor.id }),
      });
      toast(`Follow request sent to @${n.actor.username}`, "success");
      void markRead(n.id);
      void refresh();
    } catch (error) {
      apiError(error);
    } finally {
      setBusyId(null);
    }
  }

  async function enablePush() {
    const granted = await enableBrowserNotifications();
    setPushOn(granted);
    toast(granted ? "Notifications enabled" : "Notifications blocked in your browser", granted ? "success" : "danger");
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "likes", label: "Likes" },
    { key: "comments", label: "Comments" },
    { key: "cliqs", label: "Follows" },
  ];

  return (
    <div className="fixed inset-0 z-[85] flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        data-testid="notification-center"
        onClick={(e) => e.stopPropagation()}
        className="cliq-drawer flex h-dvh w-full flex-col border-white/10 bg-zinc-950/90 backdrop-blur-xl md:max-w-[400px] md:border-l"
      >
        <div className="flex h-[53px] shrink-0 items-center justify-between border-b border-white/10 px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="text-zinc-400 transition hover:text-white md:hidden"
            >
              <ArrowLeft size={20} strokeWidth={1.75} />
            </button>
            <p className="text-base font-semibold text-white">Notifications</p>
            {counts.notifications > 0 ? (
              <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff3040] px-1 text-[11px] font-bold text-white">
                {counts.notifications > 9 ? "9+" : counts.notifications}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void enablePush()}
              aria-label="Enable browser notifications"
              title={pushOn ? "Notifications on" : "Enable notifications"}
              className={cx(
                "grid h-8 w-8 place-items-center rounded-full transition",
                pushOn ? "text-[#4f46e5]" : "text-zinc-500 hover:text-zinc-200",
              )}
            >
              {pushOn ? <BellRing size={18} strokeWidth={1.75} /> : <Bell size={18} strokeWidth={1.75} />}
            </button>
            <button
              type="button"
              onClick={() => void markRead()}
              disabled={counts.notifications === 0}
              className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[#4f46e5] transition hover:text-white disabled:opacity-40"
            >
              Mark all read
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-200">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="no-scrollbar flex shrink-0 gap-2 border-b border-white/10 px-3 py-2">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cx(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                filter === key ? "bg-white text-black" : "bg-[#121216] text-zinc-400 hover:text-zinc-100",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="cliq-scroll flex-1 overflow-y-auto p-2">
          {isLoading && notifications.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-8 text-xs text-zinc-500">
              <Spinner /> Loading...
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-zinc-500">
              No activity yet.
              <br />
              Likes, comments and follows will land here.
            </p>
          ) : (
            (["new", "today", "earlier"] as const).map((bucket) =>
              groups[bucket].length === 0 ? null : (
                <div key={bucket} className="mb-1">
                  <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    {bucket === "new" ? "New" : bucket === "today" ? "Today" : "Earlier"}
                  </p>
                  {groups[bucket].map((n) => {
                    const badge = badgeFor(n.kind);
                    const isCliq = ["friend_request", "friend_accept", "cliqup"].includes(n.kind);
                    return (
                      <div
                        key={n.id}
                        className={cx(
                          "flex items-center gap-3 rounded-lg p-2.5 transition hover:bg-zinc-900",
                          !n.isRead && "bg-[#121216]",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => void openNotification(n)}
                          className="relative shrink-0 rounded-full"
                          aria-label="Open"
                        >
                          {n.actor ? <Avatar user={n.actor} size={44} /> : <span className="h-11 w-11 rounded-full bg-zinc-800" />}
                          <span
                            className={cx(
                              "absolute -bottom-0.5 -right-0.5 grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-black text-white",
                              badge.className,
                            )}
                          >
                            {badge.icon}
                          </span>
                        </button>

                        <button type="button" onClick={() => void openNotification(n)} className="min-w-0 flex-1 text-left">
                          <span className="line-clamp-2 block text-sm leading-snug text-zinc-200">
                            <span className="font-semibold text-white">@{n.actor?.username ?? "someone"}</span>{" "}
                            {n.text}
                          </span>
                          <span className="mt-0.5 block text-xs text-zinc-500">{relativeTime(n.createdAt)}</span>
                        </button>

                        {isCliq && n.actor ? (
                          <button
                            type="button"
                            onClick={() => void cliqBack(n)}
                            disabled={busyId === n.id}
                            className="shrink-0 rounded-lg bg-[#4f46e5] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#6366f1] disabled:opacity-50"
                          >
                            {busyId === n.id ? <Spinner className="h-3 w-3" /> : "Follow"}
                          </button>
                        ) : n.kind === "message" ? (
                          <button
                            type="button"
                            onClick={() => void openNotification(n)}
                            className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15"
                          >
                            Reply
                          </button>
                        ) : n.post ? (
                          <button
                            type="button"
                            onClick={() => void openNotification(n)}
                            className="shrink-0 overflow-hidden rounded-md"
                            aria-label="Open post"
                          >
                            {n.post.mediaUrl && n.post.type !== "chat" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={n.post.mediaUrl} alt="" className="h-11 w-11 rounded-md object-cover" />
                            ) : (
                              <span className="grid h-11 w-11 place-items-center rounded-md border border-white/10 p-1">
                                <span className="line-clamp-2 text-[8px] leading-tight text-zinc-500">
                                  {n.post.content || "post"}
                                </span>
                              </span>
                            )}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}
