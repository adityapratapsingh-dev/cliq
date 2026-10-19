/**
 * Shared-post references inside chat messages.
 *
 * A shared post is encoded as a marker in the message body:
 *
 *   [[cliq:post:<postId>]]  optional note text
 *
 * This deliberately avoids a schema change — the existing `content` column
 * carries the reference, so older clients degrade to showing the raw marker
 * while newer clients render a rich embedded card.
 */

const MARKER = /\[\[cliq:post:([^\]]+)\]\]/;

function marker(postId: string): string {
  return `[[cliq:post:${postId}]]`;
}

export function encodeSharedPost(postId: string, note?: string): string {
  const clean = note?.trim();
  return clean ? `${marker(postId)} ${clean}` : marker(postId);
}

export interface SharedPostRef {
  postId: string;
  note: string;
}

/** Returns the referenced post id and any accompanying note, or null. */
export function parseSharedPost(content: string | undefined | null): SharedPostRef | null {
  if (!content) return null;
  const match = content.match(MARKER);
  if (!match) return null;
  return { postId: match[1], note: content.replace(match[0], "").trim() };
}

/** Short label for the conversation-list preview. */
export function sharedPostPreviewLabel(type: string | null | undefined): string {
  if (type === "photo") return "📷 Shared a photo";
  if (type === "video") return "🎬 Shared a reel";
  if (type === "chat") return "💬 Shared a post";
  return "🔗 Shared a post";
}
