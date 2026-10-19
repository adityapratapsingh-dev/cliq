"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";
import type { PublicUser } from "@/types/cliq";
import { avatarGradient, cx, initials } from "@/lib/utils";

/**
 * Circular avatar.
 *
 * Falls back to a muted monochrome gradient with initials when the user has no
 * image, so the UI never shows a broken-image box.
 */
export function Avatar({
  user,
  size = 40,
  ring,
  online,
}: {
  user: Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl">;
  size?: number;
  ring?: boolean;
  online?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const gradient = avatarGradient(user.username || user.id);
  const showImage = Boolean(user.avatarUrl) && !broken;

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className={cx(
          "inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-1 ring-inset ring-white/15",
          ring && "ring-2 ring-zinc-600 ring-offset-2 ring-offset-black",
        )}
        style={{
          background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
          fontSize: size * 0.36,
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
        }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl as string}
            alt={user.displayName}
            className="h-full w-full object-cover" loading="lazy" decoding="async"
            onError={() => setBroken(true)}
          />
        ) : (
          initials(user.displayName || user.username)
        )}
      </span>
      {online ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-black bg-[#10b981] shadow-[0_0_0_1px_rgba(16,185,129,0.5)]"
          style={{ width: Math.max(10, size * 0.28), height: Math.max(10, size * 0.28) }}
        />
      ) : null}
    </span>
  );
}

/**
 * Flat placeholder tile for media that has no image.
 *
 * Renders a dark neutral panel with an optional vector glyph — no gradients, no
 * emoji — so it reads as an intentional empty state.
 */
export function ArtBlock({
  label,
  icon,
  className,
  children,
}: {
  label?: string;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cx("relative overflow-hidden bg-zinc-900", className)} style={{ background: "#121212" }}>
      {icon ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-700">
          {icon}
        </div>
      ) : null}
      {label ? (
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
          {label}
        </span>
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
      className="flex w-full items-center justify-between gap-4 border-b border-[#262626] px-1 py-3.5 text-left transition hover:bg-zinc-900/60"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-100">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span> : null}
      </span>
      <span
        className={cx(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
          checked ? (danger ? "bg-[#ff3040]" : "bg-[#4f46e5]") : "bg-zinc-700",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200",
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
  mobileFull = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: string;
  /** When true, the sheet fills the whole viewport on mobile portrait. */
  mobileFull?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className={cx(
        "fixed inset-0 z-[80] flex justify-center",
        mobileFull ? "items-stretch sm:items-center sm:p-4" : "items-end sm:items-center sm:p-4",
      )}
    >
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-black"
      />
      <div
        className={cx(
          "cliq-pop relative flex w-full flex-col overflow-hidden border border-[#262626] bg-[#0d0d10] shadow-2xl",
          mobileFull
            ? "h-full rounded-none sm:h-auto sm:max-h-[85vh] sm:rounded-2xl"
            : "max-h-[92dvh] rounded-t-2xl sm:rounded-2xl",
          maxWidth,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#262626] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-50">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="cliq-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function SectionCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-xl border border-[#262626] bg-[#121216] p-4", className)}>{children}</div>
  );
}

export function Pill({
  children,
  color,
  onClick,
  active,
  title,
}: {
  children: ReactNode;
  color?: string;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) {
  const style: CSSProperties | undefined = active
    ? { background: color ?? "#4f46e5", borderColor: "transparent", color: "#fff" }
    : undefined;

  if (onClick) {
    return (
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={cx(
          "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition",
          active ? "border-transparent text-white" : "border-[#262626] text-zinc-300 hover:border-zinc-700",
        )}
        style={style}
      >
        {children}
      </button>
    );
  }
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
        active ? "border-transparent text-white" : "border-[#262626] text-zinc-300",
      )}
      style={style}
    >
      {children}
    </span>
  );
}

export function IconButton({
  icon,
  count,
  label,
  onClick,
  active,
  activeColor,
  title,
  disabled,
}: {
  icon: ReactNode;
  count?: number | string;
  label?: string;
  onClick?: () => void;
  active?: boolean;
  activeColor?: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "group inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium transition disabled:opacity-40",
        active ? "" : "text-zinc-500 hover:text-zinc-200",
      )}
      style={active ? { color: activeColor ?? "#4f46e5" } : undefined}
    >
      <span className={cx(onClick && "transition group-active:scale-90")}>{icon}</span>
      {count !== undefined ? <span className="tabular-nums">{count}</span> : null}
      {label ? <span className="hidden sm:inline">{label}</span> : null}
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="cliq-rise relative flex flex-col items-center justify-center gap-3 overflow-hidden px-6 py-16 text-center">
      {/* Soft duotone ambient glow behind the illustration. */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 h-40 w-64 -translate-y-6 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(99,102,241,0.35), transparent 70%)" }}
      />
      <span className="relative grid h-16 w-16 place-items-center rounded-2xl border border-[#262626] bg-gradient-to-br from-indigo-500/20 to-violet-500/10 text-indigo-300 shadow-inner">
        {icon}
      </span>
      <p className="relative text-base font-semibold text-zinc-200">{title}</p>
      {hint ? <p className="relative max-w-sm text-xs leading-relaxed text-zinc-500">{hint}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="relative mt-1 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-500/20 transition hover:from-violet-500 hover:to-indigo-500 active:scale-95"
        >
          {actionLabel}
        </button>
      ) : null}
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

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("cliq-skeleton rounded-lg bg-zinc-900", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="border-b border-[#262626] p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
      </div>
      <Skeleton className="mt-3 h-40 w-full" />
    </div>
  );
}
