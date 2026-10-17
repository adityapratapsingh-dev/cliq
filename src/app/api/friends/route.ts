import { ApiError } from "@/types/cliq";
import { fail, ok, readJson, requireString } from "@/lib/api";
import { requireSessionUser } from "@/lib/server-auth";
import { getStore } from "@/lib/store";
import { notify } from "@/lib/notify";

/** GET /api/friends — friends, incoming/outgoing requests and suggestions. */
export async function GET() {
  try {
    const me = await requireSessionUser();
    const store = getStore();
    const graph = await store.listFriends(me.id);
    return ok(graph);
  } catch (error) {
    return fail(error);
  }
}

interface Body {
  action?: "request" | "accept" | "decline";
  userId?: string;
  friendshipId?: string;
}

/** POST /api/friends — send a "Cliq Up" request, or accept/decline one. */
export async function POST(request: Request) {
  try {
    const me = await requireSessionUser();
    const body = await readJson<Body>(request);
    const store = getStore();
    const action = body.action ?? "request";

    if (action === "request") {
      const userId = requireString(body.userId, "User id", { max: 200 });
      if (userId === me.id) throw new ApiError(400, "You cannot Cliq Up yourself.");
      const target = await store.getUserById(userId);
      if (!target) throw new ApiError(404, "That user does not exist.");
      const friendship = await store.sendFriendRequest(me.id, userId);
      if (friendship.status === "pending") {
        await notify({
          userId,
          actorId: me.id,
          kind: "friend_request",
          text: "sent you a Cliq Up request",
        });
      } else if (friendship.status === "accepted") {
        // They had already asked us, so this call auto-accepted.
        await notify({
          userId,
          actorId: me.id,
          kind: "friend_accept",
          text: "accepted your Cliq Up",
        });
      }
      const graph = await store.listFriends(me.id);
      return ok({ friendship, ...graph }, { status: 201 });
    }

    const friendshipId = requireString(body.friendshipId, "Friendship id", { max: 200 });
    const friendship = await store.respondFriendRequest(friendshipId, me.id, action === "accept");
    if (action === "accept" && friendship.requesterId !== me.id) {
      await notify({
        userId: friendship.requesterId,
        actorId: me.id,
        kind: "friend_accept",
        text: "accepted your Cliq Up",
      });
    }
    const graph = await store.listFriends(me.id);
    return ok({ friendship, ...graph });
  } catch (error) {
    return fail(error);
  }
}
