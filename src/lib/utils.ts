export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

let counter = 0;
export function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
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

export function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString();
}

export function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}

export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

export function avatarGradient(stops: [string, string]): string {
  return `linear-gradient(135deg, ${stops[0]}, ${stops[1]})`;
}

/** Public CC0 sample MP4s — no API key required. Verified reachable (HTTP 200/206). */
export const SAMPLE_VIDEOS = [
  "https://download.samplelib.com/mp4/sample-5s.mp4",
  "https://media.w3.org/2010/05/video/movie_300.mp4",
  "https://download.samplelib.com/mp4/sample-10s.mp4",
  "https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4",
  "https://download.samplelib.com/mp4/sample-15s.mp4",
  "https://media.w3.org/2010/05/sintel/trailer.mp4",
];

export function extractHashtags(text: string): string[] {
  const found = text.match(/#[\p{L}\p{N}_]+/gu);
  return found ? Array.from(new Set(found.map((t) => t.slice(1)))) : [];
}

const TOXIC_WORDS = ["stupid", "idiot", "loser", "hate you", "dumb", "ugly"];

export function censor(text: string, enabled: boolean): string {
  if (!enabled) return text;
  let out = text;
  for (const word of TOXIC_WORDS) {
    const re = new RegExp(word.replace(/ /g, "\\s+"), "gi");
    out = out.replace(re, (m) => "•".repeat(Math.max(3, m.length)));
  }
  return out;
}
