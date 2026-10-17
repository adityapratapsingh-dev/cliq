import { NOTE_MAX_LENGTH, type CliqNote } from "@/types/cliq";
import { fail, ok, readJson, requireString } from "@/lib/api";
import { requireSessionUser } from "@/lib/server-auth";
import { getStore } from "@/lib/store";
import { toPublicUser } from "@/lib/store/types";

interface Body {
  text?: string;
  emoji?: string;
  /** Pass true to clear the note. */
  clear?: boolean;
}

/**
 * POST /api/notes — set (or clear) the signed-in user's 24-hour Cliq Note.
 *
 * Notes live inside the user's `settings` JSONB column, so this reuses the
 * existing users update path and needs no schema change.
 */
export async function POST(request: Request) {
  try {
    const me = await requireSessionUser();
    const body = await readJson<Body>(request);
    const store = getStore();

    if (body.clear) {
      const updated = await store.updateUser(me.id, {
        settings: { ...me.settings, note: null },
      });
      return ok({ user: { ...toPublicUser(updated), email: updated.email, settings: updated.settings } });
    }

    const text = requireString(body.text, "Note", { max: NOTE_MAX_LENGTH });
    const emoji = typeof body.emoji === "string" ? body.emoji.slice(0, 8) : "";

    const note: CliqNote = { text, emoji, createdAt: new Date().toISOString() };
    const updated = await store.updateUser(me.id, {
      settings: { ...me.settings, note },
    });

    return ok({ user: { ...toPublicUser(updated), email: updated.email, settings: updated.settings } });
  } catch (error) {
    return fail(error);
  }
}
