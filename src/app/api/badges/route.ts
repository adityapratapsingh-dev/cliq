import { fail, ok } from "@/lib/api";
import { getSessionUser } from "@/lib/server-auth";
import { getStore } from "@/lib/store";

/**
 * GET /api/badges?userId=<id>
 *
 * Earned achievement badges for a user (defaults to the signed-in user). Readable
 * for any profile so the public Profile modal can show them too.
 */
export async function GET(request: Request) {
  try {
    const me = await getSessionUser();
    const url = new URL(request.url);
    const targetId = url.searchParams.get("userId") ?? me?.id;
    if (!targetId) return ok({ badges: [], streak: 0 });

    const store = getStore();
    const result = await store.getBadges(targetId);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
