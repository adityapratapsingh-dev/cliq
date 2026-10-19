"use client";

import { Modal } from "@/components/ui/Primitives";
import { SCORE_TIERS, SCORE_WEIGHTS, type ScoreBreakdown } from "@/lib/cliq-score";
import { cx, formatCount } from "@/lib/utils";

/**
 * Cliq Score breakdown.
 *
 * Shows the current rank badge, progress to the next tier, and exactly which
 * activities produced the points — so the score feels earned rather than opaque.
 */
export function ScoreBreakdownModal({
  open,
  onClose,
  breakdown,
}: {
  open: boolean;
  onClose: () => void;
  breakdown: ScoreBreakdown;
}) {
  const rows = [
    { label: "Posts published", detail: `${breakdown.posts.count} × ${SCORE_WEIGHTS.post}`, points: breakdown.posts.points },
    { label: "Cliq friends", detail: `${breakdown.friends.count} × ${SCORE_WEIGHTS.friend}`, points: breakdown.friends.points },
    {
      label: "Likes & upgrades received",
      detail: `${breakdown.engagement.count} × ${SCORE_WEIGHTS.engagement}`,
      points: breakdown.engagement.points,
    },
    {
      label: "Daily Note dropped",
      detail: breakdown.note.active ? `active × ${SCORE_WEIGHTS.note}` : "not set",
      points: breakdown.note.points,
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cliq Score"
      subtitle="How your activity adds up"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* Rank badge + total */}
        <div className="flex items-center gap-4 rounded-2xl border border-[#262626] bg-gradient-to-br from-indigo-600/20 to-transparent p-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-indigo-600/25 text-3xl">
            {breakdown.tier.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-black text-zinc-50">{breakdown.tier.name}</p>
            <p className="text-[11px] text-zinc-400">{breakdown.tier.blurb}</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-indigo-300">
              {formatCount(breakdown.total)}
            </p>
          </div>
        </div>

        {/* Progress to next tier */}
        {breakdown.nextTier ? (
          <div className="rounded-2xl border border-[#262626] bg-[#121216] p-3.5">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold">
              <span className="text-zinc-300">
                {breakdown.tier.emoji} {breakdown.tier.name}
              </span>
              <span className="text-zinc-500">
                {breakdown.nextTier.emoji} {breakdown.nextTier.name}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-[width] duration-500"
                style={{ width: `${breakdown.progress}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              <span className="font-bold text-zinc-300">{breakdown.toNext} points</span> to{" "}
              {breakdown.nextTier.name}
            </p>
          </div>
        ) : (
          <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-center text-[11px] font-semibold text-amber-200">
            👑 Top tier reached — you are a Cliq Legend
          </p>
        )}

        {/* Breakdown rows */}
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-xl border border-[#262626] bg-[#121216] px-3.5 py-2.5"
            >
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-zinc-200">{row.label}</span>
                <span className="block text-[10px] text-zinc-500">{row.detail}</span>
              </span>
              <span className={cx("shrink-0 text-sm font-black tabular-nums", row.points > 0 ? "text-emerald-400" : "text-zinc-600")}>
                {row.points > 0 ? `+${row.points}` : "0"}
              </span>
            </div>
          ))}
        </div>

        {/* Tier ladder */}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Ranks</p>
          <div className="flex flex-wrap gap-1.5">
            {SCORE_TIERS.map((tier) => {
              const reached = breakdown.total >= tier.min;
              return (
                <span
                  key={tier.name}
                  className={cx(
                    "rounded-full border px-2.5 py-1 text-[10px] font-bold",
                    reached
                      ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200"
                      : "border-[#262626] text-zinc-500",
                  )}
                >
                  {tier.emoji} {tier.name} · {tier.min}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
