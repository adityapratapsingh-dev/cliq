"use client";

import { useMemo, type ReactNode } from "react";
import { X } from "lucide-react";
import type { ArtSeed, CliqUser } from "@/types/cliq";
import { cx } from "@/lib/utils";

export function Avatar({
  user,
  size = 40,
  ring,
  online,
  showOnline,
}: {
  user: CliqUser;
  size?: number;
  ring?: boolean;
  online?: boolean;
  showOnline?: boolean;
}) {
  const onlineNow = online ?? user.online;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className={cx(
          "inline-flex h-full w-full items-center justify-center rounded-full font-bold text-white",
          ring && "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-zinc-950",
        )}
        style={{
          background: `linear-gradient(135deg, ${user.avatar[0]}, ${user.avatar[1]})`,
          fontSize: size * 0.4,
        }}
      >
        {user.name.charAt(0)}
      </span>
      {showOnline !== false && onlineNow ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-zinc-950 bg-emerald-400"
          style={{ width: Math.max(10, size * 0.28), height: Math.max(10, size * 0.28) }}
        />
      ) : null}
    </span>
  );
}

export function GradientArt({
  art,
  className,
  children,
  showEmoji = true,
}: {
  art: ArtSeed;
  className?: string;
  children?: ReactNode;
  showEmoji?: boolean;
}) {
  const background = useMemo(
    () =>
      `radial-gradient(120% 120% at 20% 10%, ${art.tint}44 0%, transparent 55%), linear-gradient(140deg, ${art.from} 0%, ${art.to} 100%)`,
    [art],
  );
  return (
    <div className={cx("relative overflow-hidden", className)} style={{ background }}>
      <div className="cliq-grain pointer-events-none absolute inset-0 opacity-40" />
      {showEmoji ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-6xl opacity-30 drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)]">{art.emoji}</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  danger,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-900"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-zinc-100">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span> : null}
      </span>
      <span
        className={cx(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300",
          checked ? (danger ? "bg-rose-500" : "bg-[var(--accent)]") : "bg-zinc-700",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
      />
      <div
        className={cx(
          "cliq-pop relative w-full overflow-hidden rounded-t-3xl border border-zinc-800/80 bg-zinc-900/95 shadow-2xl backdrop-blur-xl sm:rounded-3xl",
          maxWidth,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-50">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function SectionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-3xl border border-zinc-800/80 bg-zinc-900/80 p-5 backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Pill({
  children,
  color,
  onClick,
  active,
}: {
  children: ReactNode;
  color?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition",
        onClick && "hover:scale-[1.03]",
        active ? "border-transparent text-white" : "border-zinc-700/80 text-zinc-300",
      )}
      style={
        active
          ? { background: color ?? "var(--accent-grad)", borderColor: "transparent" }
          : color
            ? { borderColor: `${color}55`, color, backgroundColor: `${color}18` }
            : undefined
      }
    >
      {children}
    </Comp>
  );
}

export function IconStat({
  icon,
  label,
  count,
  active,
  activeColor,
  onClick,
  title,
}: {
  icon: ReactNode;
  label?: string;
  count?: number | string;
  active?: boolean;
  activeColor?: string;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      className={cx(
        "group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold transition",
        active ? "" : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100",
      )}
      style={active ? { color: activeColor ?? "var(--accent)" } : undefined}
    >
      <span className={cx("transition-transform", onClick && "group-active:scale-90")}>{icon}</span>
      {count !== undefined ? <span className="tabular-nums">{count}</span> : null}
      {label ? <span className="hidden sm:inline">{label}</span> : null}
    </button>
  );
}

export function EmptyState({ emoji, title, hint }: { emoji: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/40 px-6 py-14 text-center">
      <span className="text-4xl">{emoji}</span>
      <p className="text-sm font-semibold text-zinc-200">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent",
        className,
      )}
    />
  );
}

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="cliq-typing-dot h-1.5 w-1.5 rounded-full bg-current"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}
