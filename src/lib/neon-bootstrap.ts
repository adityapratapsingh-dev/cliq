import { query } from "@/lib/neon";
import { SCHEMA_STATEMENTS } from "@/lib/neon-schema";

let tablesReady: Promise<void> | null = null;

/**
 * Create every table/index if missing.
 *
 * Idempotent and memoised per process, so it costs one round-trip on cold start
 * and nothing afterwards. Postgres cannot run DDL in a multi-statement prepared
 * query, so each statement is issued individually.
 */
export function ensureTablesExist(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      for (const sql of SCHEMA_STATEMENTS) {
        await query(sql);
      }
    })().catch((error) => {
      // Allow a later request to retry rather than caching the failure forever.
      tablesReady = null;
      throw error;
    });
  }
  return tablesReady;
}
