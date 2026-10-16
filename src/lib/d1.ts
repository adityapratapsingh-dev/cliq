import { SCHEMA_STATEMENTS } from "@/lib/schema";

/**
 * Minimal Cloudflare D1 client over the HTTP REST API.
 *
 * Works on Vercel's Node runtime (no bindings needed) as long as these env vars
 * are set:
 *   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_DATABASE_ID, CLOUDFLARE_API_TOKEN
 *
 * When they are missing the helper reports `configured: false` instead of
 * throwing, so the app can transparently fall back to the in-memory store.
 */

export interface D1QueryResult<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

export interface D1Config {
  accountId: string;
  databaseId: string;
  apiToken: string;
}

export function getD1Config(): D1Config | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const databaseId = process.env.CLOUDFLARE_DATABASE_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !databaseId || !apiToken) return null;
  return { accountId, databaseId, apiToken };
}

export function isD1Configured(): boolean {
  return getD1Config() !== null;
}

function endpoint(config: D1Config): string {
  return `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`;
}

interface CloudflareResponse<T> {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: { results?: T[]; success?: boolean; meta?: Record<string, unknown> }[];
}

/**
 * Run one or more SQL statements. Accepts either a single statement or an array
 * (Cloudflare executes arrays in an implicit transaction).
 */
export async function d1Query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const rows = await d1Batch<T>([{ sql, params }]);
  return rows[0] ?? [];
}

export async function d1Batch<T = Record<string, unknown>>(
  statements: { sql: string; params?: unknown[] }[],
): Promise<T[][]> {
  const config = getD1Config();
  if (!config) {
    throw new Error("D1 is not configured (missing CLOUDFLARE_* environment variables).");
  }

  // Cloudflare accepts either a single { sql, params } object or a batch
  // wrapped as { batch: [...] }. A bare array is rejected with error 7400
  // ("Expected object, received array"), so always send one of those two shapes.
  const body =
    statements.length === 1
      ? { sql: statements[0].sql, params: statements[0].params ?? [] }
      : { batch: statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })) };

  const response = await fetch(endpoint(config), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  let parsed: CloudflareResponse<T> | null = null;
  try {
    parsed = text ? (JSON.parse(text) as CloudflareResponse<T>) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok || !parsed?.success) {
    const detail =
      parsed?.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") ||
      text.slice(0, 300) ||
      `HTTP ${response.status}`;
    throw new Error(`D1 query failed — ${detail}`);
  }

  const results = parsed.result ?? [];
  // A single-statement request returns one result object; a batch returns many.
  const list = Array.isArray(results) ? results : [results];
  return list.map((r) => (Array.isArray(r?.results) ? (r.results as T[]) : []));
}

let tablesReady: Promise<void> | null = null;

/**
 * Create every table/index if missing. Idempotent and memoised per process, so
 * it costs one round-trip on cold start and nothing afterwards.
 */
export function ensureTablesExist(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      if (!isD1Configured()) return;
      await d1Batch(SCHEMA_STATEMENTS.map((sql) => ({ sql })));
    })().catch((error) => {
      // Allow a later request to retry rather than caching the failure forever.
      tablesReady = null;
      throw error;
    });
  }
  return tablesReady;
}
