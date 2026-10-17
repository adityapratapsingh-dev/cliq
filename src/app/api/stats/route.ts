import { fail, ok } from "@/lib/api";
import { requireSessionUser } from "@/lib/server-auth";
import { getStore } from "@/lib/store";

/**
 * GET /api/stats — real counters for the signed-in user's profile header.
 *
 * Counts come from the friendships and posts tables so the Profile tab shows
 * integers rather than placeholders.
 */
export async function GET() {
  try {
    const me = await requireSessionUser();
    const store = getStore();
    const stats = await store.getStats(me.id);
    return ok(stats);
  } catch (error) {
    return fail(error);
  }
}
