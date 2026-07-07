/**
 * Shared PostgreSQL pool for API routes (aicumen-dev Cloud SQL).
 *
 * SQL safety: always pass user-controlled values via the second arg to
 * `client.query(text, values)` using `$1`, `$2`, ... placeholders. Never
 * concatenate untrusted input into query text.
 *
 * ## Connection modes
 *
 * 1. **Cloud SQL connector** (recommended; no IP allowlist needed).
 *    Set `CLOUD_SQL_INSTANCE` to the instance id (e.g. `aicumen-dev-db`); the
 *    connection name is built as `GOOGLE_PROJECT_ID:GCP_FUNCTION_REGION:instance`.
 *    Or set `INSTANCE_CONNECTION_NAME` to the full `project:region:instance`.
 *    Uses `GOOGLE_SA_KEY_BASE64` (or `GOOGLE_APPLICATION_CREDENTIALS`) with a
 *    service account that has `roles/cloudsql.client` and the Cloud SQL Admin
 *    API enabled.
 *
 * 2. **Direct TCP** (simplest for local dev).
 *    Leave the connector env unset and set `DB_HOST` to the instance public IP.
 */
import type { Pool, QueryResult, QueryResultRow } from "pg";
import { Pool as PgPool } from "pg";
import { initGoogleCreds } from "@/lib/google-credentials";

const globalForDb = globalThis as unknown as {
  __pgPool?: PgPool;
  __pgPoolInit?: Promise<PgPool>;
  __asyncPool?: Pool;
};

function instanceConnectionName(): string | undefined {
  const full = (
    process.env.INSTANCE_CONNECTION_NAME ?? process.env.CLOUD_SQL_INSTANCE_CONNECTION_NAME
  )?.trim();
  if (full) return full;

  const instance = process.env.CLOUD_SQL_INSTANCE?.trim();
  const project = (process.env.GOOGLE_PROJECT_ID ?? process.env.GCP_PROJECT)?.trim();
  const region = process.env.GCP_FUNCTION_REGION?.trim();
  if (instance && project && region) return `${project}:${region}:${instance}`;
  return undefined;
}

async function createPool(): Promise<PgPool> {
  const name = instanceConnectionName();
  if (name) {
    initGoogleCreds();
    const { Connector, IpAddressTypes } = await import("@google-cloud/cloud-sql-connector");
    const { GoogleAuth } = await import("google-auth-library");

    const ipRaw = (process.env.CLOUD_SQL_IP_TYPE || "PUBLIC").toUpperCase();
    const ipType =
      ipRaw === "PRIVATE"
        ? IpAddressTypes.PRIVATE
        : ipRaw === "PSC"
          ? IpAddressTypes.PSC
          : IpAddressTypes.PUBLIC;

    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/sqlservice.admin"],
    });

    const connector = new Connector({ auth });
    (globalThis as unknown as { __gcpCloudSqlConnector?: unknown }).__gcpCloudSqlConnector = connector;

    const clientOpts = await connector.getOptions({ instanceConnectionName: name, ipType });

    return new PgPool({
      ...clientOpts,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15_000,
      application_name: "aicumen-web",
    });
  }

  return new PgPool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    application_name: "aicumen-web",
  });
}

function getPoolReady(): Promise<PgPool> {
  if (globalForDb.__pgPool) return Promise.resolve(globalForDb.__pgPool);
  if (!globalForDb.__pgPoolInit) {
    globalForDb.__pgPoolInit = createPool().then((p) => {
      globalForDb.__pgPool = p;
      return p;
    });
  }
  return globalForDb.__pgPoolInit;
}

/**
 * `pg` Pool with async-first init (the Cloud SQL connector requires
 * `await getOptions()`). Call sites use `await pool.connect()` / `await
 * pool.query()`.
 */
function createAsyncPoolProxy(): Pool {
  return new Proxy({} as Pool, {
    get(_target, prop) {
      if (prop === "then" || prop === "catch" || prop === "finally" || prop === Symbol.toStringTag) {
        return undefined;
      }
      return (...args: unknown[]) =>
        getPoolReady().then((p) => {
          const v = (p as unknown as Record<string | symbol, unknown>)[prop];
          if (typeof v === "function") {
            return (v as (...a: unknown[]) => unknown).apply(p, args);
          }
          return v;
        });
    },
  });
}

if (!globalForDb.__asyncPool) {
  globalForDb.__asyncPool = createAsyncPoolProxy();
}
export const pool: Pool = globalForDb.__asyncPool;

/** Await the real pool (e.g. health checks, scripts). */
export async function getPool(): Promise<Pool> {
  return getPoolReady();
}

/** Strongly-typed `pool.query` helper (the Proxy can confuse TS inference). */
export async function poolQuery<T extends QueryResultRow = QueryResultRow>(
  queryText: string,
  values?: unknown[],
): Promise<QueryResult<T>> {
  const p = await getPoolReady();
  return p.query<T>(queryText, values);
}
