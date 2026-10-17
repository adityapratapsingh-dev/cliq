import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Neon PostgreSQL access.
 *
 * A single `pg.Pool` is memoised on `globalThis` so Vercel's serverless
 * instances reuse connections between invocations instead of opening a new one
 * per request. The pool is created lazily, so importing this module during a
 * build (when DATABASE_URL may be absent) never throws.
 */

function sslConfig(): boolean | { rejectUnauthorized: boolean } {
  // Neon terminates TLS with a publicly trusted certificate, so verification is
  // on by default. Set DATABASE_SSL=no-verify only if a proxy breaks the chain.
  return process.env.DATABASE_SSL === "no-verify" ? { rejectUnauthorized: false } : true;
}

export function isNeonConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function connectionString(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not configured.");
  // Neon appends `sslmode=require`; pg reads it, but we set ssl explicitly too so
  // the behaviour is identical if the query string is trimmed.
  return url;
}

const globalForPg = globalThis as unknown as { __cliqPool?: Pool };

export function getPool(): Pool {
  if (!globalForPg.__cliqPool) {
    globalForPg.__cliqPool = new Pool({
      connectionString: connectionString(),
      ssl: sslConfig(),
      max: Number(process.env.PG_POOL_MAX ?? 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // Neon's pooled endpoint already multiplexes, so keep statements simple.
      allowExitOnIdle: true,
    });
    // A pool-level error (e.g. the server closing an idle connection) must not
    // crash the process.
    globalForPg.__cliqPool.on("error", (error) => {
      console.error("[neon] idle client error:", error.message);
    });
  }
  return globalForPg.__cliqPool;
}

/** Run a parameterised query. Always use placeholders ($1, $2, ...). */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params as never[]);
  return result.rows;
}

/** Run a single row, or null. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Run several statements inside a transaction, rolling back on any failure.
 * Used where partial writes would corrupt state (e.g. reaction counters).
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
