import { ApiError } from "@/types/cliq";
import { fail, ok } from "@/lib/api";
import { requireSessionUser } from "@/lib/server-auth";
import { getStore } from "@/lib/store";

/**
 * GET /api/posts/[id] — a single post with its author and counts.
 *
 * Used by the embedded shared-post card in Direct Chats, which only stores the
 * post id in the message body and resolves the details on render.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireSessionUser();
    const { id } = await params;
    const store = getStore();
    const post = await store.getPost(id, me.id);
    if (!post) throw new ApiError(404, "That post no longer exists.");
    return ok({ post });
  } catch (error) {
    return fail(error);
  }
}
