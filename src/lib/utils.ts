export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatCount(n: number): string {
  if (Math.abs(n) < 1000) return `${n}`;
  if (Math.abs(n) < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function clockTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "now";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Compact relative time for notification rows, Instagram style:
 * "Just now", "3m", "2h", "1d", "4w".
 */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Just now";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 45) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export function extractHashtags(text: string): string[] {
  const found = text.match(/#[\p{L}\p{N}_]+/gu);
  return found ? Array.from(new Set(found.map((t) => t.slice(1)))) : [];
}

const TOXIC_WORDS = ["stupid", "idiot", "loser", "hate you", "dumb", "ugly"];

/** Soft-censor unkind words when the Safe-Chat filter is enabled. */
export function censor(text: string, enabled: boolean): string {
  if (!enabled) return text;
  let out = text;
  for (const word of TOXIC_WORDS) {
    const re = new RegExp(word.replace(/ /g, "\\s+"), "gi");
    out = out.replace(re, (m) => "•".repeat(Math.max(3, m.length)));
  }
  return out;
}

/**
 * Deterministic, vibrant gradient for a user without an avatar image.
 *
 * Seeded by the username so every account gets a stable, distinct colour pair
 * (Instagram-style). Kept in the indigo/violet/rose/cyan family so the palette
 * stays cohesive with the brand accent.
 */
export function avatarGradient(seed: string): [string, string] {
  const palettes: [string, string][] = [
    ["#6366f1", "#a855f7"],
    ["#8b5cf6", "#ec4899"],
    ["#4f46e5", "#22d3ee"],
    ["#d946ef", "#6366f1"],
    ["#0ea5e9", "#8b5cf6"],
    ["#f43f5e", "#8b5cf6"],
    ["#10b981", "#0ea5e9"],
    ["#f59e0b", "#ec4899"],
    ["#a855f7", "#4f46e5"],
    ["#06b6d4", "#6366f1"],
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return palettes[hash % palettes.length];
}

/**
 * A deterministic mesh-gradient cover for a user, derived from their username.
 *
 * Used when no custom banner image has been uploaded, so a profile never shows
 * an empty black box. Kept dark and low-saturation so it reads as a tasteful
 * cover rather than a neon blob.
 */
export function meshGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const rot = hash % 40;
  const hue = 245 + rot;
  const hue2 = (hue + 55) % 360;
  const hue3 = (hue + 190) % 360;
  return [
    `radial-gradient(at 18% 20%, hsl(${hue} 46% 30% / 0.9) 0px, transparent 55%)`,
    `radial-gradient(at 82% 16%, hsl(${hue2} 42% 26% / 0.8) 0px, transparent 52%)`,
    `radial-gradient(at 72% 86%, hsl(${hue3} 36% 24% / 0.7) 0px, transparent 55%)`,
    "linear-gradient(135deg, #121317 0%, #09090b 100%)",
  ].join(", ");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ageBadge(age: number | null): string {
  return age ? `${age}` : "Teen";
}

/** How long a Cliq Note stays live. */
export const NOTE_TTL_MS = 24 * 60 * 60 * 1000;
export const NOTE_MAX_CHARS = 60;

/** True when a note exists and was set within the last 24 hours. */
export function noteIsFresh(note: { createdAt?: string | null } | null | undefined): boolean {
  if (!note?.createdAt) return false;
  const then = new Date(note.createdAt).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then < NOTE_TTL_MS;
}
