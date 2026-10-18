"use client";

import { useMemo, useState } from "react";
import {
  Bell,
  BellRing,
  Check,
  Heart,
  MessageCircle,
  MessageSquare,
  Rocket,
  X,
  Zap,
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
      return { icon: <Heart size={10} className="fill-current" />, className: "bg-rose-500" };
    case "dislike":
      return { icon: <Heart size={10} className="fill-current" />, className: "bg-amber-500" };
    case "upgrade":
      return { icon: <Rocket size={10} />, className: "bg-emerald-500" };
    case "downgrade":
      return { icon: <Rocket size={10} className="rotate-180" />, className: "bg-amber-500" };
    case "comment":
    case "reply":
      return { icon: <MessageCircle size={10} />, className: "bg-cyan-500" };
    case "friend_request":
    case "friend_accept":
    case "cliqup":
      return { icon: <Zap size={10} className="fill-current" />, className: "bg-violet-500" };
    default:
      return { icon: <MessageSquare size={10} />, className: "bg-zinc-600" };
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
  const filtered = useMemo(
    () => notifications.filter((n) => matchesFilter(n, filter)),
    [notifications, filter],
  );

  const groups = useMemo(() => {
    const buckets: Record<"new" | "today" | "earlier", CliqNotification[]> = { new: [], today: [], earlier: [] };
    for (const n of filtered) buckets[bucketOf(n, now)].push(n);
    return buckets;
  }, [filtered, now]);

  /** Open the target of a notification and mark it read. */
  async function openNotification(n: CliqNotification) {
    setBusyId(n.id);
    void markRead(n.id);
    try {
      if (n.kind === "message") {
        setTab("friends");
      } else if (n.post?.type === "video") {
        setTab("videos");
      } else if (n.post?.type === "photo") {
        setTab("photos");
      } else if (n.post?.type === "chat") {
        setTab("chatposts");
      } else if (["friend_request", "friend_accept", "cliqup"].includes(n.kind)) {
        setTab("friends");
      }
      onNavigate(n.kind === "message" ? "friends" : "videos");
      onClose();
    } catch (error) {
      apiError(error);
    } finally {
      setBusyId(null);
    }
  }

  /** Accept a Cliq request straight from the row. */
  async function cliqBack(n: CliqNotification) {
    if (!n.actor) return;
    setBusyId(n.id);
    try {
      const graph = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", userId: n.actor.id }),
      }).then((r) => r.json());
      void graph;
      toast(`Cliq Up sent to @${n.actor.username} ⚡`, "success");
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
    toast(granted ? "Browser notifications enabled 🔔" : "Notifications blocked in your browser", granted ? "success" : "danger");
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "likes", label: "Likes & Upgrades" },
    { key: "comments", label: "Comments" },
    { key: "cliqs", label: "Cliqs" },
  ];

  return (
    <div
      data-testid="notification-center"
      className="cliq-pop fixed right-3 top-[4.25rem] z-50 flex max-h-[80vh] w-[min(94vw,26rem)] flex-col overflow-hidden rounded-3xl border border-zinc-800/80 bg-[#121317]/98 shadow-2xl backdrop-blur-xl sm:right-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-zinc-50">Notifications</p>
          {counts.notifications > 0 ? (
            <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white shadow-lg shadow-rose-500/40">
              {counts.notifications > 9 ? "9+" : counts.notifications}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void enablePush()}
            aria-label="Enable browser notifications"
            title={pushOn ? "Browser notifications on" : "Enable browser notifications"}
            className={cx(
              "grid h-7 w-7 place-items-center rounded-full transition",
              pushOn ? "text-[var(--accent-2)]" : "text-zinc-500 hover:text-zinc-200",
            )}
          >
            {pushOn ? <BellRing size={15} /> : <Bell size={15} />}
          </button>
          <button
            type="button"
            onClick={() => void markRead()}
            disabled={counts.notifications === 0}
            className="rounded-full border border-zinc-700/70 px-2.5 py-1 text-[10px] font-bold text-zinc-300 transition hover:border-[var(--accent)] hover:text-zinc-100 disabled:opacity-40"
          >
            Mark all read
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-zinc-800/80 px-3 py-2">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={cx(
              "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition",
              filter === key ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-100",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grouped rows */}
      <div className="cliq-scroll flex-1 overflow-y-auto p-2">
        {isLoading && notifications.length === 0 ? (
          <p className="flex items-center gap-2 px-3 py-8 text-xs text-zinc-500">
            <Spinner /> Loading...
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-10 text-center text-xs text-zinc-500">
            Nothing here yet ✨
            <br />
            Likes, comments and Cliq Ups will land here.
          </p>
        ) : (
          (["new", "today", "earlier"] as const).map((bucket) =>
            groups[bucket].length === 0 ? null : (
              <div key={bucket} className="mb-1">
                <p className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {bucket === "new" ? "New" : bucket === "today" ? "Today" : "Earlier"}
                </p>
                {groups[bucket].map((n) => {
                  const badge = badgeFor(n.kind);
                  const isCliq = ["friend_request", "friend_accept", "cliqup"].includes(n.kind);
                  return (
                    <div
                      key={n.id}
                      className={cx(
                        "flex items-center gap-3 rounded-2xl p-2.5 transition",
                        !n.isRead && "bg-rose-500/10",
                        "hover:bg-zinc-800/50",
                      )}
                    >
                      {/* Actor avatar + overlaid kind badge */}
                      <button
                        type="button"
                        onClick={() => void openNotification(n)}
                        className="relative shrink-0 rounded-full transition hover:brightness-110"
                        aria-label="Open"
                      >
                        {n.actor ? (
                          <Avatar user={n.actor} size={44} />
                        ) : (
                          <span className="h-11 w-11 rounded-full bg-zinc-800" />
                        )}
                        <span
                          className={cx(
                            "absolute -bottom-0.5 -right-0.5 grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-zinc-900 text-white",
                            badge.className,
                          )}
                        >
                          {badge.icon}
                        </span>
                      </button>

                      {/* Text */}
                      <button
                        type="button"
                        onClick={() => void openNotification(n)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="flex items-center gap-1.5">
                          {!n.isRead ? <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" /> : null}
                          <span className="truncate text-xs font-bold text-zinc-50">
                            @{n.actor?.username ?? "someone"}
                          </span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-zinc-300">
                          {n.text}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-zinc-500">{relativeTime(n.createdAt)}</span>
                      </button>

                      {/* Right: thumbnail, or a Cliq Back / Message action */}
                      {isCliq && n.actor ? (
                        <button
                          type="button"
                          onClick={() => void cliqBack(n)}
                          disabled={busyId === n.id}
                          className="shrink-0 rounded-full bg-indigo-600 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                        >
                          {busyId === n.id ? <Spinner className="h-3 w-3" /> : "Cliq Back ⚡"}
                        </button>
                      ) : n.post ? (
                        <button
                          type="button"
                          onClick={() => void openNotification(n)}
                          className="shrink-0 overflow-hidden rounded-lg"
                          aria-label="Open post"
                        >
                          {n.post.mediaUrl && n.post.type !== "chat" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={n.post.mediaUrl} alt="" className="h-11 w-11 rounded-lg object-cover" />
                          ) : (
                            <span className="grid h-11 w-11 place-items-center rounded-lg border border-zinc-700/70 bg-zinc-950/70 p-1">
                              <span className="line-clamp-2 text-[8px] leading-tight text-zinc-400">
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

      <button
        type="button"
        onClick={() => {
          setTab("friends");
          onClose();
        }}
        className="inline-flex w-full items-center justify-center gap-1.5 border-t border-zinc-800/80 px-4 py-3 text-xs font-semibold text-[var(--accent-2)] transition hover:bg-zinc-800/60"
      >
        <Check size={13} /> Open Chats &amp; Friends
      </button>
    </div>
  );
}
