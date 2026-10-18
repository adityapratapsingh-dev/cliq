"use client";

import { useEffect, useState } from "react";
import { Heart, MessageCircle, Rocket, UserPlus, X } from "lucide-react";
import { useCliq } from "@/components/CliqProvider";
import { Avatar } from "@/components/ui/Primitives";
import { useNotificationCenter } from "@/components/notifications/useNotificationCenter";
import { showBrowserNotification } from "@/lib/browser-notify";
import type { CliqNotification, NotificationKind } from "@/types/cliq";
import { cx } from "@/lib/utils";

/** Icon glyph for each notification kind (no emoji). */
function bannerIcon(kind: NotificationKind) {
  switch (kind) {
    case "like":
    case "dislike":
      return <Heart size={14} className="fill-current text-[#ff3040]" />;
    case "upgrade":
    case "downgrade":
      return <Rocket size={14} className="text-[#10b981]" />;
    case "friend_request":
    case "friend_accept":
    case "cliqup":
      return <UserPlus size={14} className="text-[#4f46e5]" />;
    default:
      return <MessageCircle size={14} className="text-[#4f46e5]" />;
  }
}

/**
 * Instagram-style drop-down in-app banner.
 *
 * Slides down from the top for 4 seconds when a genuinely-new notification
 * arrives while the user is browsing. Tapping it jumps to the relevant place.
 */
export function NotificationBanner({ onOpenCenter }: { onOpenCenter: () => void }) {
  const { setTab, apiError } = useCliq();
  const { fresh, consumeFresh, markRead } = useNotificationCenter();
  const [current, setCurrent] = useState<CliqNotification | null>(null);

  // Show the newest fresh notification, then clear the queue.
  useEffect(() => {
    if (fresh.length === 0) return;
    setCurrent(fresh[0]);
    consumeFresh();
  }, [fresh, consumeFresh]);

  // Auto-dismiss after 4s, and mirror to a native notification if enabled.
  useEffect(() => {
    if (!current) return;
    showBrowserNotification(
      `Cliq · @${current.actor?.username ?? "someone"}`,
      current.text,
      current.id,
    );
    const timer = setTimeout(() => setCurrent(null), 4000);
    return () => clearTimeout(timer);
  }, [current]);

  if (!current) return null;

  async function open() {
    if (!current) return;
    void markRead(current.id);
    try {
      if (current.kind === "message") setTab("friends");
      else if (current.post?.type === "video") setTab("videos");
      else if (current.post?.type === "photo") setTab("photos");
      else if (current.post?.type === "chat") setTab("chatposts");
      else setTab("friends");
      onOpenCenter();
    } catch (error) {
      apiError(error);
    }
    setCurrent(null);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[95] flex justify-center px-3">
      <div
        data-testid="notification-banner"
        className="cliq-toast pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-zinc-700/60 bg-zinc-900/90 p-3 shadow-2xl backdrop-blur-xl"
      >
        <button type="button" onClick={() => void open()} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {current.actor ? <Avatar user={current.actor} size={40} /> : <span className="h-10 w-10 rounded-full bg-zinc-800" />}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[#121216]">
                {bannerIcon(current.kind)}
              </span>
              <span className="truncate text-xs font-bold text-zinc-50">
                @{current.actor?.username ?? "someone"}
              </span>
            </span>
            <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-zinc-300">{current.text}</span>
          </span>
          {current.kind === "message" ? <MessageCircle size={16} className="shrink-0 text-[var(--accent-2)]" /> : null}
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setCurrent(null)}
          className={cx("shrink-0 rounded-full p-1.5 text-zinc-500 transition hover:text-zinc-200")}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
