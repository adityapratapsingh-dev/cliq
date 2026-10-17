import { newId } from "@/lib/auth";
import { getStore } from "@/lib/store";
import type { NotificationKind } from "@/types/cliq";

interface NotifyInput {
  /** Who receives it. */
  userId: string;
  /** Who caused it. Never notify yourself. */
  actorId: string;
  kind: NotificationKind;
  postId?: string | null;
  /** Short action text shown in the row, e.g. "liked your photo". */
  text: string;
}

/**
 * Insert a notification row.
 *
 * Centralised so every trigger shares the same two guarantees:
 *   1. we never notify the actor about their own action
 *   2. a failure to notify never fails the user's actual request
 *
 * Notifications are a side effect — if the insert fails, the like/comment/send
 * has still succeeded and the user should not see an error.
 */
export async function notify(input: NotifyInput): Promise<void> {
  if (!input.actorId || input.actorId === input.userId) return;
  try {
    await getStore().createNotification({
      id: newId("n"),
      userId: input.userId,
      actorId: input.actorId,
      kind: input.kind,
      postId: input.postId ?? null,
      text: input.text,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Swallow: the primary action already succeeded.
  }
}

/** Human-readable label for a post type, used in notification text. */
export function postNoun(type: string): string {
  if (type === "video") return "reel";
  if (type === "photo") return "photo";
  return "post";
}

/** Trim a snippet so a long comment does not bloat the row. */
export function snippet(text: string, max = 60): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}
