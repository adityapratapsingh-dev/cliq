import type { Group, StoryBgStyle } from "@/types/cliq";

/** How long a Cliq Story stays live. */
export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

/** Gradient themes for stylized text stories. */
export const STORY_BG_STYLES: { key: StoryBgStyle; label: string; gradient: string }[] = [
  { key: "indigo", label: "Indigo", gradient: "linear-gradient(135deg,#1d1f3a 0%,#2a2d52 60%,#3b3f6b 100%)" },
  { key: "sunset", label: "Sunset", gradient: "linear-gradient(135deg,#3a2416 0%,#5a2f26 55%,#6b3a4a 100%)" },
  { key: "mint", label: "Mint", gradient: "linear-gradient(135deg,#0f2a24 0%,#14403a 100%)" },
  { key: "midnight", label: "Midnight", gradient: "linear-gradient(135deg,#0b0b12 0%,#1b1b2e 100%)" },
  { key: "candy", label: "Candy", gradient: "linear-gradient(135deg,#3a1730 0%,#2c1b3d 55%,#16303f 100%)" },
  { key: "ember", label: "Ember", gradient: "linear-gradient(135deg,#3a2410 0%,#4a1f18 60%,#2a1208 100%)" },
];

export function storyGradient(style: StoryBgStyle): string {
  return STORY_BG_STYLES.find((s) => s.key === style)?.gradient ?? STORY_BG_STYLES[0].gradient;
}

/**
 * The 5 always-active public interest lounges every member can jump into.
 *
 * `icon` is left blank — the UI renders a clean vector glyph instead of an emoji.
 */
export const DEFAULT_LOUNGES: { id: string; name: string; description: string; icon: string }[] = [
  { id: "lounge_gaming", name: "Gaming Squad", description: "Ranked grinds, clips and LFG", icon: "" },
  { id: "lounge_music", name: "Music & Vibes", description: "Share what you're listening to", icon: "" },
  { id: "lounge_latenight", name: "Late Night Chats", description: "For the 1am crowd", icon: "" },
  { id: "lounge_tech", name: "Tech & Coding", description: "Build things, break things", icon: "" },
  { id: "lounge_memes", name: "Memes & Trends", description: "Certified brain rot only", icon: "" },
];

/** Stable creation timestamp for a seeded lounge, so ordering is deterministic. */
export function groupSeededAt(index: number): string {
  return new Date(Date.UTC(2024, 0, 1, 0, index)).toISOString();
}

/**
 * Build the 5 built-in lounges. `joined` is always true because public lounges
 * are open to everyone, and the member count is supplied by the caller.
 */
export function seededLounges(memberCount = 0): Group[] {
  return DEFAULT_LOUNGES.map((lounge, index) => ({
    id: lounge.id,
    name: lounge.name,
    description: lounge.description,
    icon: lounge.icon,
    creatorId: "system",
    isPublic: true,
    memberCount,
    joined: true,
    lastMessageAt: null,
    createdAt: groupSeededAt(index),
  }));
}
