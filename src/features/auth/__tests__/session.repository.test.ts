// @vitest-environment node

import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cleanupMock, transactionMock } = vi.hoisted(() => ({
  cleanupMock: vi.fn(),
  transactionMock: vi.fn(),
}));
vi.mock('@/src/server/db/postgres', () => ({
  queryOne: vi.fn(),
  withTransaction: transactionMock,
}));
vi.mock('@/src/server/security/auth-record-cleanup', () => ({
  maybePruneExpiredAuthRecords: cleanupMock,
}));

import { SessionRepository } from '../repositories/session.repository';

function useClient(query: ReturnType<typeof vi.fn>) {
  const client = { query } as unknown as PoolClient;
  transactionMock.mockImplementation(async operation => operation(client));
}

describe('SessionRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_TOKEN_PEPPER = Buffer.alloc(32, 11).toString('base64');
    cleanupMock.mockResolvedValue(undefined);
  });

  it('stores only a keyed hash of the opaque refresh credential', async () => {
    const expiresAt = new Date('2026-09-20T12:00:00.000Z');
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ expires_at: expiresAt }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    useClient(query);

    const credentials = await new SessionRepository().createUserSession('user-1', 3);

    const insertedHash = query.mock.calls[1]?.[1]?.[2];
    expect(credentials.refreshToken).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(insertedHash).toMatch(/^[0-9a-f]{64}$/);
    expect(insertedHash).not.toBe(credentials.refreshToken);
    expect(credentials.refreshTokenExpiresAt).toEqual(expiresAt);
    expect(cleanupMock).toHaveBeenCalledOnce();
  });

  it('rotates a refresh token once while retaining the logical session', async () => {
    const now = new Date('2026-08-20T12:00:00.000Z');
    const expiry = new Date('2026-09-19T12:00:00.000Z');
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            session_id: '11111111-1111-4111-8111-111111111111',
            user_id: 'user-1',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'user-1', token_version: 3, is_active: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            user_id: 'user-1',
            token_version: 3,
            expires_at: expiry,
            revoked_at: null,
            database_now: now,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'old-token-id',
            session_id: '11111111-1111-4111-8111-111111111111',
            expires_at: expiry,
            consumed_at: null,
            revoked_at: null,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValue({ rows: [], rowCount: 1 });
    useClient(query);

    const result = await new SessionRepository().rotateRefreshToken('old-opaque-token');

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('Expected a successful rotation');
    expect(result.credentials.sessionId).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.credentials.refreshToken).not.toBe('old-opaque-token');
    expect(query.mock.calls[1]?.[0]).toContain('public.users');
    expect(query.mock.calls[2]?.[0]).toContain('FOR UPDATE');
    expect(query.mock.calls[4]?.[0]).toContain('SET consumed_at');
    const nextStoredHash = query.mock.calls[5]?.[1]?.[2];
    expect(nextStoredHash).toMatch(/^[0-9a-f]{64}$/);
    expect(nextStoredHash).not.toBe(result.credentials.refreshToken);
  });

  it('revokes the whole session when a consumed refresh token is replayed', async () => {
    const now = new Date('2026-08-20T12:00:00.000Z');
    const expiry = new Date('2026-09-19T12:00:00.000Z');
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            session_id: '11111111-1111-4111-8111-111111111111',
            user_id: 'user-1',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'user-1', token_version: 3, is_active: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            user_id: 'user-1',
            token_version: 3,
            expires_at: expiry,
            revoked_at: null,
            database_now: now,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'old-token-id',
            session_id: '11111111-1111-4111-8111-111111111111',
            expires_at: expiry,
            consumed_at: new Date(now.getTime() - 20_000),
            revoked_at: null,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValue({ rows: [], rowCount: 1 });
    useClient(query);

    await expect(new SessionRepository().rotateRefreshToken('replayed-token')).resolves.toEqual({
      status: 'replayed',
    });
    expect(query.mock.calls[4]?.[1]).toEqual([
      '11111111-1111-4111-8111-111111111111',
      'refresh_token_replay',
    ]);
    expect(query.mock.calls[5]?.[0]).toContain('auth_refresh_tokens');
  });

  it('treats an immediate concurrent reuse as stale without revoking the session', async () => {
    const now = new Date('2026-08-20T12:00:00.000Z');
    const expiry = new Date('2026-09-19T12:00:00.000Z');
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            session_id: '11111111-1111-4111-8111-111111111111',
            user_id: 'user-1',
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{ id: 'user-1', token_version: 3, is_active: true }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            user_id: 'user-1',
            token_version: 3,
            expires_at: expiry,
            revoked_at: null,
            database_now: now,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'old-token-id',
            session_id: '11111111-1111-4111-8111-111111111111',
            expires_at: expiry,
            consumed_at: new Date(now.getTime() - 1_000),
            revoked_at: null,
          },
        ],
        rowCount: 1,
      });
    useClient(query);

    await expect(new SessionRepository().rotateRefreshToken('concurrent-token')).resolves.toEqual({
      status: 'already_rotated',
    });
    expect(query).toHaveBeenCalledTimes(4);
  });

  it('locks user then sessions before consuming a password-reset token', async () => {
    const now = new Date('2026-08-20T12:00:00.000Z');
    const resetCodeHash = 'b'.repeat(64);
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ user_id: 'user-1', email: 'test@example.com' }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 'session-1' }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'reset-1',
            user_id: 'user-1',
            expires_at: new Date(now.getTime() + 60_000),
            consumed_at: null,
            email_confirmation_code_hash: resetCodeHash,
            email_confirmation_code_expires_at: new Date(now.getTime() + 120_000),
            email_confirmation_attempts: 0,
            database_now: now,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }], rowCount: 1 })
      .mockResolvedValue({ rows: [], rowCount: 1 });
    useClient(query);

    await expect(
      new SessionRepository().consumePasswordResetToken(
        'r'.repeat(64),
        'test@example.com',
        resetCodeHash,
        'scrypt$new'
      )
    ).resolves.toBe('user-1');

    expect(query.mock.calls[1]?.[0]).toContain('public.users');
    expect(query.mock.calls[2]?.[0]).toContain('public.auth_sessions');
    expect(query.mock.calls[3]?.[0]).toContain('public.password_reset_tokens');
    expect(query.mock.calls[3]?.[0]).toContain('FOR UPDATE');
    expect(query.mock.calls[7]?.[0]).toContain('UPDATE public.auth_sessions');
    expect(query.mock.calls[8]?.[0]).toContain('UPDATE public.auth_refresh_tokens');
  });
});
