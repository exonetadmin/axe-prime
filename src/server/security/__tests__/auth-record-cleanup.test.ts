// @vitest-environment node

import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { transactionMock } = vi.hoisted(() => ({ transactionMock: vi.fn() }));

vi.mock('@/src/server/db/postgres', () => ({ withTransaction: transactionMock }));

import { pruneExpiredAuthRecords } from '../auth-record-cleanup';

describe('authentication record cleanup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('prunes only retained stale rows in bounded non-blocking lock order', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    transactionMock.mockImplementation(async (operation: (client: PoolClient) => Promise<void>) =>
      operation({ query } as unknown as PoolClient)
    );

    await pruneExpiredAuthRecords();

    expect(query).toHaveBeenCalledTimes(9);
    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements[0]).toContain('statement_timeout');
    expect(statements[1]).toContain('lock_timeout');
    expect(statements.slice(2, 4).every(sql => sql.includes('public.auth_sessions'))).toBe(true);
    expect(statements.slice(4, 7).every(sql => sql.includes('public.auth_refresh_tokens'))).toBe(
      true
    );
    expect(statements.slice(7).every(sql => sql.includes('public.password_reset_tokens'))).toBe(
      true
    );
    for (const statement of statements.slice(2)) {
      expect(statement).toContain('FOR UPDATE SKIP LOCKED');
      expect(statement).toContain('LIMIT $2');
    }
    expect(query.mock.calls[2]?.[1]).toEqual([expect.any(Number), 8]);
    expect(query.mock.calls[3]?.[1]).toEqual([expect.any(Number), 8]);
    for (const [, values] of query.mock.calls.slice(4)) {
      expect(values).toEqual([expect.any(Number), 256]);
    }
    expect(statements[3]).toContain('revoked_at IS NULL');
    expect(statements[6]).toContain('consumed_at IS NULL');
    expect(statements[8]).toContain('consumed_at IS NULL');
  });
});
