import '@/src/server/server-only';

import { Pool, type PoolClient, type QueryResultRow } from 'pg';

type GlobalWithPool = typeof globalThis & {
  __axePrimePostgresPool?: Pool;
};

const globalWithPool = globalThis as GlobalWithPool;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function assertNoConnectionStringSslOverrides(connectionString: string): void {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://');
  }

  const forbidden = new Set([
    'ssl',
    'sslcert',
    'sslkey',
    'sslmode',
    'sslpassword',
    'sslrootcert',
    'uselibpqcompat',
    'options',
  ]);
  for (const [name] of parsed.searchParams) {
    if (forbidden.has(name.toLowerCase())) {
      throw new Error(
        'Remove SSL/options parameters from DATABASE_URL; use the dedicated database settings instead'
      );
    }
  }
}

function createPool(): Pool {
  const connectionString = requiredEnv('DATABASE_URL');
  assertNoConnectionStringSslOverrides(connectionString);
  const sslMode = (
    process.env.DATABASE_SSL_MODE ??
    (process.env.NODE_ENV === 'production' ? 'verify-full' : 'disable')
  ).toLowerCase();

  if (!['disable', 'require', 'verify-full'].includes(sslMode)) {
    throw new Error('DATABASE_SSL_MODE must be one of: disable, require, verify-full');
  }

  if (sslMode === 'disable' && process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_SSL_MODE=disable is not allowed in production');
  }

  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n').trim();
  if (ca && !ca.includes('BEGIN CERTIFICATE')) {
    throw new Error('DATABASE_CA_CERT must contain a PEM certificate');
  }
  const ssl =
    sslMode === 'disable'
      ? false
      : {
          rejectUnauthorized: true,
          ...(ca ? { ca } : {}),
        };

  const pool = new Pool({
    connectionString,
    ssl,
    max: readPositiveInteger('DATABASE_POOL_MAX', 10),
    idleTimeoutMillis: readPositiveInteger('DATABASE_IDLE_TIMEOUT_MS', 30_000),
    connectionTimeoutMillis: readPositiveInteger('DATABASE_CONNECTION_TIMEOUT_MS', 10_000),
    application_name: 'axe-prime-web',
    options: '-c search_path=pg_catalog,public',
  });

  pool.on('error', error => {
    console.error('[PostgreSQL] Unexpected idle client error', error);
  });

  return pool;
}

export function getPool(): Pool {
  if (!globalWithPool.__axePrimePostgresPool) {
    globalWithPool.__axePrimePostgresPool = createPool();
  }
  return globalWithPool.__axePrimePostgresPool;
}

export async function query<Row extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = []
): Promise<Row[]> {
  const result = await getPool().query<Row>(text, [...values]);
  return result.rows;
}

export async function queryOne<Row extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = []
): Promise<Row | null> {
  const rows = await query<Row>(text, values);
  return rows[0] ?? null;
}

/**
 * PostgreSQL returns BIGINT values as strings. Convert them only when they can
 * be represented exactly by JavaScript, so financial totals never wrap or
 * silently lose precision.
 */
export function postgresIntegerToSafeNumber(
  value: string | number | bigint | null | undefined,
  field = 'PostgreSQL integer'
): number {
  if (value === null || value === undefined) return 0;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new RangeError(`${field} is outside JavaScript's safe integer range`);
  }
  return parsed;
}

export async function execute(text: string, values: readonly unknown[] = []): Promise<number> {
  const result = await getPool().query(text, [...values]);
  return result.rowCount ?? 0;
}

export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  const pool = globalWithPool.__axePrimePostgresPool;
  if (!pool) return;
  globalWithPool.__axePrimePostgresPool = undefined;
  await pool.end();
}
