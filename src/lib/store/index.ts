import { isD1Configured } from "@/lib/d1";
import { isNeonConfigured } from "@/lib/neon";
import { D1Store } from "@/lib/store/d1";
import { getMemoryStore } from "@/lib/store/memory";
import { NeonStore } from "@/lib/store/neon";
import type { Store } from "@/lib/store/types";

export type { Store } from "@/lib/store/types";
export { toPublicUser } from "@/lib/store/types";

type Backend = "neon" | "d1" | "memory";

let cached: { store: Store; kind: Backend } | null = null;

function pickBackend(): Backend {
  // Neon Postgres is the production database. D1 remains as a fallback for
  // existing deployments, and the in-memory store keeps local dev working with
  // no configuration at all.
  if (isNeonConfigured()) return "neon";
  if (isD1Configured()) return "d1";
  return "memory";
}

export function getStore(): Store {
  const kind = pickBackend();
  if (!cached || cached.kind !== kind) {
    if (kind === "neon") cached = { store: new NeonStore(), kind };
    else if (kind === "d1") cached = { store: new D1Store(), kind };
    else cached = { store: getMemoryStore(), kind };
  }
  return cached.store;
}

/** Which backend is live. Surfaced in Settings so the setup state is visible. */
export function activeBackend(): Backend {
  return pickBackend();
}

/**
 * True when no real database is configured, i.e. we are on the in-memory store.
 * The UI shows an admin setup hint in this case.
 */
export function usingFallbackStore(): boolean {
  return pickBackend() === "memory";
}
