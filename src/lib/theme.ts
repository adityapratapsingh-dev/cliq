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
 * `violet` is the default and resolves to Cliq Indigo-Violet — the single brand
 * accent used for primary actions (`+ Create`, Post, Cliq Up, Publish, active
 * states). The others remain available from Settings for personalisation.
 */
export const ACCENTS: Record<AccentKey, AccentDef> = {
  violet: {
    key: "violet",
    label: "Cliq Indigo",
    accent: "#4f46e5",
    accent2: "#6366f1",
    accent3: "#818cf8",
    gradient: "#4f46e5",
    soft: "rgba(79, 70, 229, 0.16)",
  },
  cyan: {
    key: "cyan",
    label: "Cyan",
    accent: "#0891b2",
    accent2: "#06b6d4",
    accent3: "#22d3ee",
    gradient: "#06b6d4",
    soft: "rgba(6, 182, 212, 0.14)",
  },
  rose: {
    key: "rose",
    label: "Rose",
    accent: "#e11d48",
    accent2: "#f43f5e",
    accent3: "#fb7185",
    gradient: "#f43f5e",
    soft: "rgba(244, 63, 94, 0.14)",
  },
  emerald: {
    key: "emerald",
    label: "Emerald",
    accent: "#059669",
    accent2: "#10b981",
    accent3: "#34d399",
    gradient: "#10b981",
    soft: "rgba(16, 185, 129, 0.14)",
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
