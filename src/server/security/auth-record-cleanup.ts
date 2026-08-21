import '@/src/server/server-only';

import { withTransaction } from '@/src/server/db/postgres';

const RETENTION_DAYS = (() => {
  const raw = process.env.AUTH_RECORD_RETENTION_DAYS?.trim() || '7';
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new Error('AUTH_RECORD_RETENTION_DAYS must be a positive integer');
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value > 3_650) {
    throw new Error('AUTH_RECORD_RETENTION_DAYS must be between 1 and 3650');
  }
  return value;
})();

const SESSION_CLEANUP_BATCH_SIZE = 8;
const TOKEN_CLEANUP_BATCH_SIZE = 256;
const CLEANUP_INTERVAL_MILLISECONDS = 60_000;
let cleanupInFlight: Promise<void> | null = null;
let nextCleanupAt = 0;

/**
 * Retains replay/audit evidence for a bounded period, then removes it in small
 * non-blocking batches. Deleting sessions cascades to their remaining refresh
 * credentials; active, unexpired sessions are never selected.
 */
export async function pruneExpiredAuthRecords(): Promise<void> {
  await withTransaction(async client => {
    await client.query("SET LOCAL statement_timeout = '2s'");
    await client.query("SET LOCAL lock_timeout = '250ms'");
    // Preserve the same session -> refresh-token ordering used by rotation.
    await client.query(
      `WITH stale AS (
         SELECT id
           FROM public.auth_sessions
          WHERE revoked_at < clock_timestamp() - ($1::integer * INTERVAL '1 day')
          ORDER BY revoked_at
          LIMIT $2
          FOR UPDATE SKIP LOCKED
       )
       DELETE FROM public.auth_sessions target
        USING stale
        WHERE target.id = stale.id`,
      [RETENTION_DAYS, SESSION_CLEANUP_BATCH_SIZE]
    );

    await client.query(
      `WITH stale AS (
         SELECT id
           FROM public.auth_sessions
          WHERE revoked_at IS NULL
            AND expires_at < clock_timestamp() - ($1::integer * INTERVAL '1 day')
          ORDER BY expires_at
          LIMIT $2
          FOR UPDATE SKIP LOCKED
       )
       DELETE FROM public.auth_sessions target
        USING stale
        WHERE target.id = stale.id`,
      [RETENTION_DAYS, SESSION_CLEANUP_BATCH_SIZE]
    );

    await client.query(
      `WITH stale AS (
         SELECT id
           FROM public.auth_refresh_tokens
          WHERE consumed_at < clock_timestamp() - ($1::integer * INTERVAL '1 day')
          ORDER BY consumed_at
          LIMIT $2
          FOR UPDATE SKIP LOCKED
       )
       DELETE FROM public.auth_refresh_tokens target
        USING stale
        WHERE target.id = stale.id`,
      [RETENTION_DAYS, TOKEN_CLEANUP_BATCH_SIZE]
    );

    await client.query(
      `WITH stale AS (
         SELECT id
           FROM public.auth_refresh_tokens
          WHERE revoked_at < clock_timestamp() - ($1::integer * INTERVAL '1 day')
          ORDER BY revoked_at
          LIMIT $2
          FOR UPDATE SKIP LOCKED
       )
       DELETE FROM public.auth_refresh_tokens target
        USING stale
        WHERE target.id = stale.id`,
      [RETENTION_DAYS, TOKEN_CLEANUP_BATCH_SIZE]
    );

    await client.query(
      `WITH stale AS (
         SELECT id
           FROM public.auth_refresh_tokens
          WHERE consumed_at IS NULL
            AND revoked_at IS NULL
            AND expires_at < clock_timestamp() - ($1::integer * INTERVAL '1 day')
          ORDER BY expires_at
          LIMIT $2
          FOR UPDATE SKIP LOCKED
       )
       DELETE FROM public.auth_refresh_tokens target
        USING stale
        WHERE target.id = stale.id`,
      [RETENTION_DAYS, TOKEN_CLEANUP_BATCH_SIZE]
    );

    await client.query(
      `WITH stale AS (
         SELECT id
           FROM public.password_reset_tokens
          WHERE consumed_at < clock_timestamp() - ($1::integer * INTERVAL '1 day')
          ORDER BY consumed_at
          LIMIT $2
          FOR UPDATE SKIP LOCKED
       )
       DELETE FROM public.password_reset_tokens target
        USING stale
        WHERE target.id = stale.id`,
      [RETENTION_DAYS, TOKEN_CLEANUP_BATCH_SIZE]
    );

    await client.query(
      `WITH stale AS (
         SELECT id
           FROM public.password_reset_tokens
          WHERE consumed_at IS NULL
            AND expires_at < clock_timestamp() - ($1::integer * INTERVAL '1 day')
          ORDER BY expires_at
          LIMIT $2
          FOR UPDATE SKIP LOCKED
       )
       DELETE FROM public.password_reset_tokens target
        USING stale
        WHERE target.id = stale.id`,
      [RETENTION_DAYS, TOKEN_CLEANUP_BATCH_SIZE]
    );
  });
}

/**
 * Runs at most once per minute per process and always before credential state
 * changes. Concurrent callers do not wait for the same maintenance task.
 */
export async function maybePruneExpiredAuthRecords(): Promise<void> {
  const now = Date.now();
  if (cleanupInFlight || now < nextCleanupAt) return;
  nextCleanupAt = now + CLEANUP_INTERVAL_MILLISECONDS;
  cleanupInFlight = pruneExpiredAuthRecords()
    .catch(() => {
      console.error('[Auth] Expired authentication record cleanup failed');
    })
    .finally(() => {
      cleanupInFlight = null;
    });
  await cleanupInFlight;
}
