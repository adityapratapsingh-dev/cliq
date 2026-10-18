import { ApiError } from "@/types/cliq";
import { newId } from "@/lib/auth";
import { fail, ok, optionalString, readJson, requireString } from "@/lib/api";
import { requireSessionUser } from "@/lib/server-auth";
import { getStore } from "@/lib/store";
import { notify, snippet } from "@/lib/notify";

/**
 * GET /api/groups
 *   ?id=<groupId>  -> messages in that group (also joins public lounges)
 *   (no params)    -> every group, with member counts and join state
 *
 * Polled every few seconds while a group room is open.
 */
export async function GET(request: Request) {
  try {
    const me = await requireSessionUser();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const store = getStore();

    if (!id) {
      const groups = await store.listGroups(me.id);
      return ok({ groups });
    }

    const groupId = requireString(id, "Group id", { max: 200 });
    const messages = await store.listGroupMessages(groupId, me.id);
    return ok({ messages });
  } catch (error) {
    return fail(error);
  }
}

interface Body {
  action?: "create" | "join";
  /** create */
  name?: string;
  description?: string;
  icon?: string;
  memberIds?: string[];
  /** join */
  groupId?: string;
}

/** POST /api/groups — create a new group or join an existing one. */
export async function POST(request: Request) {
  try {
    const me = await requireSessionUser();
    const body = await readJson<Body>(request);
    const store = getStore();
    const action = body.action ?? "create";

    if (action === "join") {
      const groupId = requireString(body.groupId, "Group id", { max: 200 });
      const group = await store.joinGroup(groupId, me.id);
      return ok({ group });
    }

    const name = requireString(body.name, "Group name", { max: 60 });
    const description = optionalString(body.description, "Description", 200) ?? "";
    const icon = optionalString(body.icon, "Icon", 8) ?? "💬";
    const memberIds = Array.isArray(body.memberIds)
      ? body.memberIds.filter((v): v is string => typeof v === "string").slice(0, 50)
      : [];

    const group = await store.createGroup({
      id: newId("grp"),
      name,
      description,
      icon,
      creatorId: me.id,
      isPublic: false,
      memberIds,
      createdAt: new Date().toISOString(),
    });

    // Let invited friends know they've been added.
    for (const memberId of memberIds) {
      if (memberId === me.id) continue;
      await notify({
        userId: memberId,
        actorId: me.id,
        kind: "message",
        text: `added you to the group "${snippet(name, 30)}"`,
      });
    }

    return ok({ group }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

interface MessageBody {
  groupId?: string;
  content?: string;
  mediaUrl?: string | null;
}

/** PUT /api/groups — post a message into a group. */
export async function PUT(request: Request) {
  try {
    const me = await requireSessionUser();
    const body = await readJson<MessageBody>(request);
    const groupId = requireString(body.groupId, "Group id", { max: 200 });
    const content = optionalString(body.content, "Message", 2000) ?? "";
    const mediaUrl = optionalString(body.mediaUrl, "Media URL", 2000);
    if (!content && !mediaUrl) throw new ApiError(400, "Write something or attach media.");

    const store = getStore();
    const message = await store.createGroupMessage({
      id: newId("gm"),
      groupId,
      senderId: me.id,
      content,
      mediaUrl,
      createdAt: new Date().toISOString(),
    });
    return ok({ message }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

interface ReactBody {
  messageId?: string;
  emoji?: string;
}

/** PATCH /api/groups — toggle an emoji reaction on a group message. */
export async function PATCH(request: Request) {
  try {
    const me = await requireSessionUser();
    const body = await readJson<ReactBody>(request);
    const messageId = requireString(body.messageId, "Message id", { max: 200 });
    const emoji = requireString(body.emoji, "Emoji", { max: 12 });
    const store = getStore();
    const message = await store.setGroupMessageReaction(messageId, me.id, emoji);
    return ok({ message });
  } catch (error) {
    return fail(error);
  }
}
