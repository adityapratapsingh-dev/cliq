import { fail, ok, readJson } from "@/lib/api";
import { requireSessionUser } from "@/lib/server-auth";
import { getStore } from "@/lib/store";

/** Kinds that count toward each breakdown bucket in the activity pill. */
const LIKE_KINDS: string[] = ["like", "dislike"];
const UPGRADE_KINDS: string[] = ["upgrade", "downgrade"];
const COMMENT_KINDS: string[] = ["comment", "reply"];
const CLIQ_KINDS: string[] = ["friend_request", "friend_accept", "cliqup"];

/**
 * GET /api/notifications
 *
 * Returns the notification rows (each with its actor and target post joined) plus
 * every unread counter the UI needs, so a single 4s poll keeps the bell badge,
 * the Chats tab dot, and the sub-tab badges all in sync.
 */
export async function GET() {
  try {
    const me = await requireSessionUser();
    const store = getStore();

    const [notifications, counts] = await Promise.all([
      store.listNotifications(me.id),
      store.unreadCounts(me.id),
    ]);

    const unread = notifications.filter((n) => !n.isRead);
    const countOf = (kinds: string[]) => unread.filter((n) => kinds.includes(n.kind)).length;

    return ok({
      notifications,
      counts,
      breakdown: {
        like: countOf(LIKE_KINDS),
        comment: countOf(COMMENT_KINDS),
        upgrade: countOf(UPGRADE_KINDS),
        cliqp: countOf(CLIQ_KINDS),
      },
    });
  } catch (error) {
    return fail(error);
  }
}

interface PatchBody {
  /** Mark one notification read. Omit to mark all. */
  id?: string;
}

/** PATCH /api/notifications — mark one notification (or all) as read. */
export async function PATCH(request: Request) {
  try {
    const me = await requireSessionUser();
    const store = getStore();

    let id: string | undefined;
    try {
      const body = await readJson<PatchBody>(request);
      id = body?.id;
    } catch {
      // No body at all means "mark everything".
      id = undefined;
    }

    if (id) await store.markNotificationRead(id, me.id);
    else await store.markNotificationsRead(me.id);

    // Return the fresh counters so the client can reconcile immediately.
    const counts = await store.unreadCounts(me.id);
    return ok({ ok: true, counts });
  } catch (error) {
    return fail(error);
  }
}
