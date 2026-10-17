"use client";

import { Avatar } from "@/components/ui/Primitives";
import type { PublicUser } from "@/types/cliq";
import { cx } from "@/lib/utils";

/**
 * Avatar + name that opens a user's public profile when tapped.
 *
 * Used everywhere a user is shown, so any avatar or @username in the app is a
 * way into that person's profile.
 */
export function UserLink({
  user,
  size = 40,
  ring,
  onOpen,
  showName = false,
  subtitle,
  className,
}: {
  user: Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl">;
  size?: number;
  ring?: boolean;
  onOpen: (userId: string) => void;
  showName?: boolean;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cx("flex min-w-0 items-center gap-3", className)}>
      <button
        type="button"
        onClick={() => onOpen(user.id)}
        aria-label={`Open ${user.displayName}'s profile`}
        className="shrink-0 rounded-full transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <Avatar user={user} size={size} ring={ring} />
      </button>
      {showName ? (
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpen(user.id)}
            className="block max-w-full truncate text-left text-sm font-bold text-zinc-100 transition hover:text-[var(--accent-2)]"
          >
            {user.displayName}
          </button>
          {subtitle ? <p className="truncate text-[11px] text-zinc-500">{subtitle}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Inline @username button that opens the profile. */
export function UsernameLink({
  user,
  onOpen,
  className,
}: {
  user: Pick<PublicUser, "id" | "username">;
  onOpen: (userId: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(user.id)}
      className={cx("truncate text-left transition hover:text-[var(--accent-2)] hover:underline", className)}
    >
      @{user.username}
    </button>
  );
}
