import { fail, ok, requireString } from "@/lib/api";
import { requireSessionUser } from "@/lib/server-auth";
import { getStore } from "@/lib/store";

/**
 * GET /api/streaks?with=<userId>
 *
 * The consecutive-day DM streak with a partner, or a map of every streak for the
 * signed-in user when no partner is given.
 */
export async function GET(request: Request) {
  try {
    const me = await requireSessionUser();
    const url = new URL(request.url);
    const withUser = url.searchParams.get("with");
    const store = getStore();

    if (withUser) {
      const partnerId = requireString(withUser, "Conversation partner", { max: 200 });
      const streak = await store.getStreak(me.id, partnerId);
      return ok({ streak });
    }

    const conversations = await store.listConversations(me.id);
    return ok({
      streaks: conversations.map((c) => ({ userId: c.partner.id, streak: c.streak })),
    });
  } catch (error) {
    return fail(error);
  }
}
