import { ApiError, type StoryBgStyle } from "@/types/cliq";
import { newId } from "@/lib/auth";
import { fail, ok, optionalString, readJson, requireString } from "@/lib/api";
import { requireSessionUser } from "@/lib/server-auth";
import { getStore } from "@/lib/store";
import { STORY_BG_STYLES } from "@/lib/social-defaults";

const BG_STYLES: StoryBgStyle[] = STORY_BG_STYLES.map((s) => s.key);

function parseBg(value: unknown): StoryBgStyle {
  return typeof value === "string" && (BG_STYLES as string[]).includes(value)
    ? (value as StoryBgStyle)
    : "indigo";
}

/** GET /api/stories — every active (last 24h) story, grouped by author. */
export async function GET() {
  try {
    const me = await requireSessionUser();
    const store = getStore();
    const groups = await store.listStories(me.id);
    return ok({ groups });
  } catch (error) {
    return fail(error);
  }
}

interface CreateBody {
  mediaUrl?: string | null;
  caption?: string;
  bgStyle?: string;
}

/**
 * POST /api/stories — add a story.
 *
 * Either a media URL (photo / short video) or a stylized text card with a
 * gradient background — both live for 24 hours.
 */
export async function POST(request: Request) {
  try {
    const me = await requireSessionUser();
    const body = await readJson<CreateBody>(request);
    const mediaUrl = optionalString(body.mediaUrl, "Media URL", 2000);
    const caption = optionalString(body.caption, "Caption", 200) ?? "";

    if (!mediaUrl && !caption) {
      throw new ApiError(400, "Add a photo/video or some text before posting your story.");
    }

    const store = getStore();
    const story = await store.createStory({
      id: newId("st"),
      userId: me.id,
      mediaUrl,
      caption,
      bgStyle: parseBg(body.bgStyle),
      createdAt: new Date().toISOString(),
    });
    return ok({ story }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

interface PatchBody {
  /** Mark a story as viewed (idempotent). */
  viewId?: string;
}

/** PATCH /api/stories — record a view so the ring turns grey. */
export async function PATCH(request: Request) {
  try {
    const me = await requireSessionUser();
    const body = await readJson<PatchBody>(request);
    const viewId = requireString(body.viewId, "Story id", { max: 200 });
    const store = getStore();
    await store.viewStory(viewId, me.id);
    return ok({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

/** DELETE /api/stories?id=... — remove one of your own stories. */
export async function DELETE(request: Request) {
  try {
    const me = await requireSessionUser();
    const url = new URL(request.url);
    const id = requireString(url.searchParams.get("id"), "Story id", { max: 200 });
    const store = getStore();
    const deleted = await store.deleteStory(id, me.id);
    if (!deleted) throw new ApiError(404, "Story not found.");
    return ok({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
