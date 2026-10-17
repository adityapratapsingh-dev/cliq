import { ApiError } from "@/types/cliq";
import { fail, ok } from "@/lib/api";
import { getSessionUser } from "@/lib/server-auth";
import { getStore } from "@/lib/store";
import { toPublicUser } from "@/lib/store/types";

/**
 * GET /api/users/[id] — one user's public profile, for the profile modal.
 *
 * Public by design (like any social profile), but we still resolve the viewer so
 * the response shape matches the rest of the API.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await getSessionUser();
    const { id } = await params;
    const store = getStore();
    const user = await store.getUserById(id);
    if (!user) throw new ApiError(404, "That user does not exist.");

    const stats = await store.getStats(id);
    return ok({ user: toPublicUser(user), stats });
  } catch (error) {
    return fail(error);
  }
}
