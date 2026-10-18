import { ApiError, type PostType } from "@/types/cliq";
import { newId } from "@/lib/auth";
import { fail, ok, optionalString, readJson, requireString } from "@/lib/api";
import { requireSessionUser } from "@/lib/server-auth";
import { getStore } from "@/lib/store";

const TYPES: PostType[] = ["video", "photo", "chat"];

function parseType(value: string | null): PostType {
  if (value && (TYPES as string[]).includes(value)) return value as PostType;
  throw new ApiError(400, "type must be one of: video, photo, chat.");
}

/** GET /api/posts?type=video|photo|chat — feed for a tab, with author + counts. */
export async function GET(request: Request) {
  try {
    const me = await requireSessionUser();
    const url = new URL(request.url);
    const type = parseType(url.searchParams.get("type"));
    const store = getStore();
    const posts = await store.listPosts(type, me.id);
    return ok({ posts });
  } catch (error) {
    return fail(error);
  }
}

interface CreateBody {
  type?: string;
  content?: string;
  mediaUrl?: string | null;
  flair?: string | null;
  pollOptions?: string[];
  /** When set, this post is a quote repost of that post. */
  quotedPostId?: string | null;
}

/** POST /api/posts — publish a new video, photo or chat post. */
export async function POST(request: Request) {
  try {
    const me = await requireSessionUser();
    const body = await readJson<CreateBody>(request);
    const type = parseType(body.type ?? null);
    const content = optionalString(body.content, "Content", 500) ?? "";

    const store = getStore();

    // A quote repost references an existing post; validate it exists first.
    const quotedPostId = optionalString(body.quotedPostId, "Quoted post", 200);
    if (quotedPostId) {
      const original = await store.getPost(quotedPostId, me.id);
      if (!original) throw new ApiError(404, "The post you're quoting no longer exists.");
    }

    if (type === "video" && !content && !body.mediaUrl && !quotedPostId) {
      throw new ApiError(400, "Add a caption or a video URL.");
    }
    if (type === "photo" && !content && !body.mediaUrl && !quotedPostId) {
      throw new ApiError(400, "Add a caption or a photo URL.");
    }
    if (type === "chat" && !content && !quotedPostId) {
      throw new ApiError(400, "Drop a thought before posting.");
    }

    const pollOptions = Array.isArray(body.pollOptions)
      ? body.pollOptions.map((o) => (typeof o === "string" ? o.trim() : "")).filter(Boolean).slice(0, 4)
      : [];

    const post = await store.createPost({
      id: newId("p"),
      userId: me.id,
      type,
      content,
      mediaUrl: optionalString(body.mediaUrl, "Media URL", 2000),
      flair: type === "chat" ? optionalString(body.flair, "Flair", 60) ?? "#AskCliq" : null,
      flairColor: null,
      pollOptions: type === "chat" && pollOptions.length >= 2 ? pollOptions.map((text) => ({ id: newId("opt"), text })) : null,
      quotedPostId,
      createdAt: new Date().toISOString(),
    });

    return ok({ post }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}

interface PatchBody {
  id?: string;
  /** New caption/text when editing. */
  content?: string;
  /** Pin/unpin to the author's profile. */
  pinned?: boolean;
}

/** PATCH /api/posts — edit your post's caption, or pin/unpin it. */
export async function PATCH(request: Request) {
  try {
    const me = await requireSessionUser();
    const body = await readJson<PatchBody>(request);
    const id = requireString(body.id, "Post id", { max: 200 });
    const store = getStore();

    let post;
    if (body.pinned !== undefined) {
      post = await store.setPostPinned(id, me.id, Boolean(body.pinned));
    } else if (body.content !== undefined) {
      const content = optionalString(body.content, "Content", 500) ?? "";
      post = await store.updatePost(id, me.id, content);
    } else {
      throw new ApiError(400, "Provide `content` to edit or `pinned` to pin.");
    }
    return ok({ post });
  } catch (error) {
    return fail(error);
  }
}

/** DELETE /api/posts?id=... — remove one of your own posts. */
export async function DELETE(request: Request) {
  try {
    const me = await requireSessionUser();
    const url = new URL(request.url);
    const id = requireString(url.searchParams.get("id"), "Post id", { max: 200 });
    const store = getStore();
    const deleted = await store.deletePost(id, me.id);
    if (!deleted) throw new ApiError(404, "Post not found.");
    return ok({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
