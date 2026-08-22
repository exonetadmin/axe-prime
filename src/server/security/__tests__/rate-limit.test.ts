// @vitest-environment node

import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimitRepository } from '../rate-limit';

const POLICY = { limit: 5, windowSeconds: 900, blockSeconds: 600 };

function repositoryWithRows(rows: Array<Record<string, unknown>>) {
  const query = vi
    .fn()
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    .mockResolvedValueOnce({ rows, rowCount: rows.length })
    .mockResolvedValue({ rows: [], rowCount: 1 });
  const client = { query } as unknown as PoolClient;
  const runTransaction = async <T>(operation: (connection: PoolClient) => Promise<T>) =>
    operation(client);
  return {
    query,
    repository: new RateLimitRepository(runTransaction),
  };
}

describe('PostgreSQL rate limiter', () => {
  beforeEach(() => {
    process.env.AUTH_TOKEN_PEPPER = Buffer.alloc(32, 6).toString('base64');
  });

  it('increments an active bucket under a row lock', async () => {
    const now = new Date('2026-08-20T12:00:00.000Z');
    const { query, repository } = repositoryWithRows([
      {
        attempts: 2,
        window_started_at: new Date(now.getTime() - 60_000),
        blocked_until: null,
        database_now: now,
      },
    ]);

    await expect(repository.consume('login', 'account:user@example.com', POLICY)).resolves.toEqual({
      allowed: true,
      remaining: 2,
      retryAfterSeconds: 0,
    });
    expect(query.mock.calls[0]?.[0]).toContain('SKIP LOCKED');
    expect(query.mock.calls[2]?.[0]).toContain('FOR UPDATE');
    expect(query.mock.calls[3]?.[1]?.[1]).toBe(3);
    expect(query.mock.calls[3]?.[0]).toContain('updated_at = clock_timestamp()');
    expect(query.mock.calls[3]?.[1]).toHaveLength(2);
    expect(query.mock.calls[1]?.[1]?.[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(query.mock.calls[1]?.[1]?.[0]).not.toContain('user@example.com');
  });

  it('returns Retry-After without extending an existing block', async () => {
    const now = new Date('2026-08-20T12:00:00.000Z');
    const { query, repository } = repositoryWithRows([
      {
        attempts: 7,
        window_started_at: new Date(now.getTime() - 60_000),
        blocked_until: new Date(now.getTime() + 90_000),
        database_now: now,
      },
    ]);

    await expect(repository.consume('login', 'account:user@example.com', POLICY)).resolves.toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 90,
    });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('blocks the first request beyond the configured allowance', async () => {
    const now = new Date('2026-08-20T12:00:00.000Z');
    const { query, repository } = repositoryWithRows([
      {
        attempts: 5,
        window_started_at: new Date(now.getTime() - 60_000),
        blocked_until: null,
        database_now: now,
      },
    ]);

    await expect(repository.consume('login', 'account:user@example.com', POLICY)).resolves.toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 600,
    });
    expect(query.mock.calls[3]?.[1]?.[1]).toBe(6);
    expect(query.mock.calls[3]?.[1]?.[2]).toBe(600);
    expect(query.mock.calls[3]?.[0]).toContain("$3::integer * INTERVAL '1 second'");
  });

  it('starts a clean window after a previous block has elapsed', async () => {
    const now = new Date('2026-08-20T12:00:00.000Z');
    const { query, repository } = repositoryWithRows([
      {
        attempts: 8,
        window_started_at: new Date(now.getTime() - 60_000),
        blocked_until: new Date(now.getTime() - 1_000),
        database_now: now,
      },
    ]);

    await expect(repository.consume('refresh', 'token:opaque', POLICY)).resolves.toEqual({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 0,
    });
    expect(query.mock.calls[3]?.[0]).toContain('attempts = 1');
    expect(query.mock.calls[3]?.[0]).toContain('database_clock.value');
    expect(query.mock.calls[3]?.[1]).toHaveLength(1);
  });

  it('never persists a database timestamp after JavaScript truncates its microseconds', async () => {
    const { query, repository } = repositoryWithRows([
      {
        attempts: 0,
        window_started_at: '2026-08-20T12:00:00.000999Z',
        blocked_until: null,
        database_now: '2026-08-20T12:00:00.000999Z',
      },
    ]);

    await expect(repository.consume('login', 'account:new@example.com', POLICY)).resolves.toEqual({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 0,
    });

    expect(query.mock.calls[1]?.[0]).toContain('database_clock AS MATERIALIZED');
    expect(query.mock.calls[1]?.[0]).toContain('database_clock.value, database_clock.value');
    expect(query.mock.calls[3]?.[0]).toContain('clock_timestamp()');
    expect(query.mock.calls[3]?.[1]).toHaveLength(2);
    expect(query.mock.calls[3]?.[1]?.some((value: unknown) => value instanceof Date)).toBe(false);
  });
});
