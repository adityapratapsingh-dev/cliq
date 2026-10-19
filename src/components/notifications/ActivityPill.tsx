"use client";

import { useEffect, useState } from "react";
import { Heart, MessageCircle, Rocket, Zap } from "lucide-react";
import { useNotificationCenter } from "@/components/notifications/useNotificationCenter";
import { cx } from "@/lib/utils";

/**
 * Instagram-style floating activity bubble.
 *
 * Appears under the bell when new notifications land, shows a breakdown, and
 * auto-dismisses after 4 seconds (or immediately when tapped).
 */
export function ActivityPill({ onOpen }: { onOpen: () => void }) {
  const { breakdown, counts, fresh } = useNotificationCenter();
  const [visible, setVisible] = useState(false);

  const total = breakdown.like + breakdown.comment + breakdown.upgrade + breakdown.cliqp;

  // Show when fresh notifications arrive, or when the poll first sees unread
  // activity and the pill has not been dismissed yet.
  useEffect(() => {
    if (total > 0 && (fresh.length > 0 || counts.notifications > 0)) {
      setVisible(true);
    }
  }, [total, fresh.length, counts.notifications]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [visible, total]);

  if (!visible || total === 0) return null;

  const items = [
    { icon: <Heart size={11} className="fill-current" />, count: breakdown.like, className: "text-rose-400" },
    { icon: <MessageCircle size={11} />, count: breakdown.comment, className: "text-cyan-400" },
    { icon: <Rocket size={11} />, count: breakdown.upgrade, className: "text-emerald-400" },
    { icon: <Zap size={11} className="fill-current" />, count: breakdown.cliqp, className: "text-violet-400" },
  ].filter((i) => i.count > 0);

  return (
    <button
      type="button"
      data-testid="activity-pill"
      onClick={() => {
        setVisible(false);
        onOpen();
      }}
      className="cliq-pop absolute right-0 top-12 z-50 flex items-center gap-2.5 rounded-2xl border border-[#262626] bg-[#121212] px-3 py-2 shadow-2xl transition hover:border-[var(--accent)]"
    >
      {items.map((item, index) => (
        <span key={index} className={cx("inline-flex items-center gap-1 text-[11px] font-bold", item.className)}>
          {item.icon}
          {item.count}
        </span>
      ))}
      <span className="ml-1 border-l border-zinc-700/70 pl-2 text-[10px] font-semibold text-zinc-400">
        New activity
      </span>
    </button>
  );
}
