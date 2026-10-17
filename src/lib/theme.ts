import type { CSSProperties } from "react";
import type { AccentKey } from "@/types/cliq";

export interface AccentDef {
  key: AccentKey;
  label: string;
  accent: string;
  accent2: string;
  accent3: string;
  gradient: string;
  soft: string;
}

/**
 * Accent palettes.
 *
 * `violet` is the default and is deliberately **flat indigo** rather than a neon
 * three-stop gradient — the multi-stop gradient is what made buttons look heavy.
 * Primary actions read as a solid brand colour with a soft shadow, the way
 * Instagram / Threads do it.
 *
 * The other three remain available from Settings for personalisation.
 */
export const ACCENTS: Record<AccentKey, AccentDef> = {
  violet: {
    key: "violet",
    label: "Cliq Indigo",
    accent: "#4f46e5", // indigo-600
    accent2: "#6366f1", // indigo-500
    accent3: "#818cf8", // indigo-400
    gradient: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
    soft: "rgba(99, 102, 241, 0.16)",
  },
  cyan: {
    key: "cyan",
    label: "Cyber Cyan",
    accent: "#0891b2",
    accent2: "#06b6d4",
    accent3: "#22d3ee",
    gradient: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
    soft: "rgba(6, 182, 212, 0.16)",
  },
  rose: {
    key: "rose",
    label: "Electric Rose",
    accent: "#e11d48",
    accent2: "#f43f5e",
    accent3: "#fb7185",
    gradient: "linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)",
    soft: "rgba(244, 63, 94, 0.16)",
  },
  emerald: {
    key: "emerald",
    label: "Matrix Emerald",
    accent: "#059669",
    accent2: "#10b981",
    accent3: "#34d399",
    gradient: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
    soft: "rgba(16, 185, 129, 0.16)",
  },
};

export const ACCENT_LIST: AccentDef[] = [
  ACCENTS.violet,
  ACCENTS.cyan,
  ACCENTS.rose,
  ACCENTS.emerald,
];

export function accentVars(key: AccentKey): CSSProperties {
  const a = ACCENTS[key] ?? ACCENTS.violet;
  return {
    "--accent": a.accent,
    "--accent-2": a.accent2,
    "--accent-3": a.accent3,
    "--accent-grad": a.gradient,
    "--accent-soft": a.soft,
  } as CSSProperties;
}
