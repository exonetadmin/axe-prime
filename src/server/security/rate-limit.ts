import '@/src/server/server-only';

import type { PoolClient, QueryResultRow } from 'pg';
import { withTransaction } from '@/src/server/db/postgres';
import { hashOpaqueToken } from './tokens';

export type RateLimitPolicy = {
  limit: number;
  windowSeconds: number;
  blockSeconds: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitRow = QueryResultRow & {
  attempts: number;
  window_started_at: Date | string;
  blocked_until: Date | string | null;
  database_now: Date | string;
};

type TransactionRunner = <T>(operation: (client: PoolClient) => Promise<T>) => Promise<T>;

function assertPolicy(policy: RateLimitPolicy): void {
  for (const [name, value] of Object.entries(policy)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`Rate limit ${name} must be a positive integer`);
    }
  }
}

function normalizeAction(action: string): string {
  const normalized = action.trim().toLowerCase();
  if (!/^[a-z0-9:_-]{1,64}$/.test(normalized)) {
    throw new Error('Rate limit action has an invalid format');
  }
  return normalized;
}

function bucketHash(action: string, identifier: string): string {
  if (!identifier) throw new Error('Rate limit identifier is required');
  return hashOpaqueToken(`rate-limit:v1\0${action}\0${identifier}`);
}

function secondsUntil(target: Date, now: Date): number {
  return Math.max(1, Math.ceil((target.getTime() - now.getTime()) / 1000));
}

/** PostgreSQL-backed limiter shared by every application instance. */
export class RateLimitRepository {
  constructor(private readonly runTransaction: TransactionRunner = withTransaction) {}

  async consume(
    actionInput: string,
    identifier: string,
    policy: RateLimitPolicy
  ): Promise<RateLimitDecision> {
    assertPolicy(policy);
    const action = normalizeAction(actionInput);
    const keyHash = bucketHash(action, identifier);

    return this.runTransaction(async client => {
      // Bound attacker-controlled bucket growth. The indexed, batched cleanup
      // removes more stale rows than one request can create and uses SKIP
      // LOCKED so concurrent application instances do not block each other.
      await client.query(
        `WITH stale AS (
           SELECT key_hash
             FROM public.auth_rate_limits
            WHERE updated_at < clock_timestamp() - INTERVAL '24 hours'
              AND (blocked_until IS NULL OR blocked_until < clock_timestamp())
            ORDER BY updated_at
            LIMIT 64
            FOR UPDATE SKIP LOCKED
         )
         DELETE FROM public.auth_rate_limits target
          USING stale
          WHERE target.key_hash = stale.key_hash`
      );

      await client.query(
        `INSERT INTO public.auth_rate_limits (
           key_hash, action, attempts, window_started_at, updated_at
         ) VALUES ($1, $2, 0, clock_timestamp(), clock_timestamp())
         ON CONFLICT (key_hash) DO NOTHING`,
        [keyHash, action]
      );

      const result = await client.query<RateLimitRow>(
        `SELECT
           attempts,
           window_started_at,
           blocked_until,
           clock_timestamp() AS database_now
         FROM public.auth_rate_limits
         WHERE key_hash = $1
         FOR UPDATE`,
        [keyHash]
      );
      const row = result.rows[0];
      if (!row) throw new Error('Rate limit bucket could not be loaded');

      const now = new Date(row.database_now);
      const windowStartedAt = new Date(row.window_started_at);
      const blockedUntil = row.blocked_until ? new Date(row.blocked_until) : null;

      if (blockedUntil && blockedUntil.getTime() > now.getTime()) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: secondsUntil(blockedUntil, now),
        };
      }

      const windowExpired =
        now.getTime() - windowStartedAt.getTime() >= policy.windowSeconds * 1000;
      // An elapsed block starts a clean window instead of immediately
      // re-blocking a bucket whose old attempt count is already above limit.
      if (windowExpired || blockedUntil) {
        await client.query(
          `UPDATE public.auth_rate_limits
           SET attempts = 1,
               window_started_at = $2,
               blocked_until = NULL,
               updated_at = $2
           WHERE key_hash = $1`,
          [keyHash, now]
        );
        return {
          allowed: true,
          remaining: Math.max(0, policy.limit - 1),
          retryAfterSeconds: 0,
        };
      }

      const attempts = Number(row.attempts) + 1;
      if (attempts > policy.limit) {
        const nextBlockedUntil = new Date(now.getTime() + policy.blockSeconds * 1000);
        await client.query(
          `UPDATE public.auth_rate_limits
           SET attempts = $2,
               blocked_until = $3,
               updated_at = $4
           WHERE key_hash = $1`,
          [keyHash, attempts, nextBlockedUntil, now]
        );
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: policy.blockSeconds,
        };
      }

      await client.query(
        `UPDATE public.auth_rate_limits
         SET attempts = $2,
             updated_at = $3
         WHERE key_hash = $1`,
        [keyHash, attempts, now]
      );
      return {
        allowed: true,
        remaining: Math.max(0, policy.limit - attempts),
        retryAfterSeconds: 0,
      };
    });
  }

  async reset(actionInput: string, identifier: string): Promise<void> {
    const action = normalizeAction(actionInput);
    const keyHash = bucketHash(action, identifier);
    await this.runTransaction(async client => {
      await client.query('DELETE FROM public.auth_rate_limits WHERE key_hash = $1', [keyHash]);
    });
  }
}

export const authRateLimiter = new RateLimitRepository();
