import { fail, ok } from "@/lib/api";
import { requireSessionUser } from "@/lib/server-auth";
import { getStore } from "@/lib/store";

/** GET /api/notifications — the signed-in user's notifications, newest first. */
export async function GET() {
  try {
    const me = await requireSessionUser();
    const store = getStore();
    const notifications = await store.listNotifications(me.id);
    return ok({ notifications, unread: notifications.filter((n) => !n.isRead).length });
  } catch (error) {
    return fail(error);
  }
}

/** PATCH /api/notifications — mark all of the user's notifications as read. */
export async function PATCH() {
  try {
    const me = await requireSessionUser();
    const store = getStore();
    await store.markNotificationsRead(me.id);
    return ok({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
