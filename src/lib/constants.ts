import type { AccentKey, MessageScope, PostType, ReactionType } from "@/types/cliq";

/**
 * Topic flairs for chat posts.
 *
 * Labels are preserved from the original schema (posts store the flair string),
 * but the UI renders them as subtle monochrome pills — no colour emoji chrome.
 */
export const FLAIRS: { label: string; color: string }[] = [
  { label: "#AskCliq", color: "#a8a8a8" },
  { label: "#SchoolLife", color: "#a8a8a8" },
  { label: "#Gaming", color: "#a8a8a8" },
  { label: "#Music", color: "#a8a8a8" },
  { label: "#Memes", color: "#a8a8a8" },
  { label: "#Coding", color: "#a8a8a8" },
  { label: "#LateNightThoughts", color: "#a8a8a8" },
];

export const INTEREST_OPTIONS = [
  "Gaming",
  "Music",
  "Anime",
  "Coding",
  "Fitness",
  "Art",
  "Movies",
  "Memes",
] as const;

export const INTEREST_FILTERS = ["All Vibes", ...INTEREST_OPTIONS];

/**
 * Direct-message reactions.
 *
 * The API stores a short emoji key per reaction; the UI renders a heart glyph so
 * the message chrome stays emoji-free.
 */
export const MESSAGE_REACTIONS = ["❤️"];

export const ACCENT_KEYS: AccentKey[] = ["violet", "cyan", "rose", "emerald"];

export const MESSAGE_SCOPES: { key: MessageScope; label: string }[] = [
  { key: "everyone", label: "Everyone" },
  { key: "shared", label: "Shared Interests Only" },
  { key: "friends", label: "Cliq Friends Only" },
];

/** Flair chips use a single neutral tone — no per-topic rainbow. */
export function flairColor(label: string | null | undefined): string {
  void label;
  return "#a1a1aa";
}

export function postTypeLabel(type: PostType): string {
  if (type === "video") return "Video";
  if (type === "photo") return "Photo";
  return "Post";
}

export const POST_TYPES: PostType[] = ["video", "photo", "chat"];

export const REACTIONS: ReactionType[] = ["like", "dislike", "upgrade", "downgrade"];
