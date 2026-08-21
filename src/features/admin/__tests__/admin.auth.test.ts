// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieValues: new Map<string, string>(),
  cookieSet: vi.fn(),
  clientQuery: vi.fn(),
  execute: vi.fn(),
  queryOne: vi.fn(),
  withTransaction: vi.fn(),
  cleanup: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mocks.cookieValues.get(name);
      return value ? { name, value } : undefined;
    },
    set: mocks.cookieSet,
  }),
  headers: async () => new Headers(),
}));

vi.mock('@/src/server/db/postgres', () => ({
  execute: mocks.execute,
  queryOne: mocks.queryOne,
  withTransaction: mocks.withTransaction,
}));

vi.mock('@/src/server/security/rate-limit', () => ({
  authRateLimiter: {
    consume: vi.fn(),
    reset: vi.fn(),
  },
}));
vi.mock('@/src/server/security/auth-record-cleanup', () => ({
  maybePruneExpiredAuthRecords: mocks.cleanup,
}));

import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_CSRF_COOKIE,
  ADMIN_REFRESH_COOKIE,
  createAdminSession,
  getAdminSession,
  refreshAdminSession,
} from '../admin.auth';

const activeAdmin = {
  id: 'admin-1',
  name: 'Admin',
  email: 'admin@axe.example',
  role: 'master' as const,
  active: true,
  token_version: 2,
};
const authenticatedAdmin = {
  id: activeAdmin.id,
  name: activeAdmin.name,
  email: activeAdmin.email,
  role: activeAdmin.role,
  tokenVersion: activeAdmin.token_version,
};

const sessionId = '11111111-1111-4111-8111-111111111111';
const refreshTokenId = '22222222-2222-4222-8222-222222222222';

function mockRefreshTransaction(consumedAt: Date | null = null) {
  const databaseNow = new Date();
  const expiresAt = new Date(databaseNow.getTime() + 60_000);
  mocks.clientQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT token.session_id')) {
      return { rows: [{ session_id: sessionId, admin_user_id: activeAdmin.id }], rowCount: 1 };
    }
    if (sql.includes('FROM public.admin_users')) {
      return { rows: [{ ...activeAdmin }], rowCount: 1 };
    }
    if (sql.includes('FROM public.auth_sessions')) {
      return {
        rows: [
          {
            id: sessionId,
            admin_user_id: activeAdmin.id,
            user_id: null,
            token_version: activeAdmin.token_version,
            expires_at: expiresAt,
            revoked_at: null,
            database_now: databaseNow,
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes('FROM public.auth_refresh_tokens')) {
      return {
        rows: [
          {
            id: refreshTokenId,
            session_id: sessionId,
            consumed_at: consumedAt,
            revoked_at: null,
            expires_at: expiresAt,
          },
        ],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  });
}

describe('admin authentication refresh', () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = Buffer.alloc(32, 21).toString('base64');
    process.env.AUTH_TOKEN_PEPPER = Buffer.alloc(32, 22).toString('base64');
    mocks.cookieValues.clear();
    mocks.cookieSet.mockReset();
    mocks.clientQuery.mockReset();
    mocks.execute.mockReset();
    mocks.queryOne.mockReset();
    mocks.withTransaction.mockReset();
    mocks.cleanup.mockReset();
    mocks.cleanup.mockResolvedValue(undefined);
    mocks.withTransaction.mockImplementation(
      async (operation: (client: { query: typeof mocks.clientQuery }) => Promise<unknown>) =>
        operation({ query: mocks.clientQuery })
    );
  });

  it('never accepts a refresh cookie as passive page authentication', async () => {
    mocks.cookieValues.set(ADMIN_REFRESH_COOKIE, 'refresh-only');

    await expect(getAdminSession()).resolves.toBeNull();
    expect(mocks.queryOne).not.toHaveBeenCalled();
  });

  it('creates the session expiry from PostgreSQL time before issuing cookies', async () => {
    const databaseExpiry = new Date('2026-09-19T12:00:00.000Z');
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, role, token_version')) {
        return { rows: [{ ...activeAdmin }], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO public.auth_sessions')) {
        return { rows: [{ expires_at: databaseExpiry }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    await createAdminSession(authenticatedAdmin);

    const adminLock = mocks.clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes('SELECT id, role, token_version')
    );
    expect(adminLock?.[0]).toContain('token_version = $2');
    expect(adminLock?.[1]).toEqual([activeAdmin.id, activeAdmin.token_version]);

    const sessionInsert = mocks.clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO public.auth_sessions')
    );
    expect(sessionInsert?.[0]).toContain("NOW() + ($4::integer * INTERVAL '1 second')");
    const refreshInsert = mocks.clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO public.auth_refresh_tokens')
    );
    expect(refreshInsert?.[1]?.[2]).toEqual(databaseExpiry);
    expect(mocks.cookieSet.mock.calls.map(([name]) => name)).toEqual(
      expect.arrayContaining([ADMIN_ACCESS_COOKIE, ADMIN_REFRESH_COOKIE, ADMIN_CSRF_COOKIE])
    );
  });

  it('fails closed when the credential version changes before session creation', async () => {
    mocks.clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id, role, token_version')) {
        // PostgreSQL returns no row because token_version no longer matches the
        // exact version that passed password verification.
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(createAdminSession(authenticatedAdmin)).rejects.toThrow(
      'Sessão administrativa inválida.'
    );
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) =>
        String(sql).includes('INSERT INTO public.auth_sessions')
      )
    ).toBe(false);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('rotates a valid refresh token and mints a new access cookie', async () => {
    mocks.cookieValues.set(ADMIN_REFRESH_COOKIE, 'valid-refresh');
    mocks.cookieValues.set(ADMIN_CSRF_COOKIE, 'session-csrf');
    mockRefreshTransaction();

    const result = await refreshAdminSession();

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('Expected a successful admin rotation');
    expect(result.user).toMatchObject({ id: 'admin-1', role: 'master' });
    const writtenCookies = mocks.cookieSet.mock.calls.map(([name]) => name);
    expect(writtenCookies).toContain(ADMIN_ACCESS_COOKIE);
    expect(writtenCookies).toContain(ADMIN_REFRESH_COOKIE);
    expect(writtenCookies).not.toContain(ADMIN_CSRF_COOKIE);
    const statements = mocks.clientQuery.mock.calls.map(([sql]) => String(sql));
    expect(statements.some(sql => sql.includes('SET consumed_at = NOW()'))).toBe(true);
    expect(statements.some(sql => sql.includes('replaced_by_token_id'))).toBe(true);
  });

  it('does not revoke or clear cookies for a concurrent rotation inside the grace window', async () => {
    mocks.cookieValues.set(ADMIN_REFRESH_COOKIE, 'concurrent-refresh');
    mockRefreshTransaction(new Date());

    await expect(refreshAdminSession()).resolves.toEqual({ status: 'already_rotated' });

    const statements = mocks.clientQuery.mock.calls.map(([sql]) => String(sql));
    expect(statements.some(sql => sql.includes('SET revoked_at'))).toBe(false);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it('revokes the whole token family when a consumed token is replayed', async () => {
    mocks.cookieValues.set(ADMIN_REFRESH_COOKIE, 'replayed-refresh');
    mockRefreshTransaction(new Date(Date.now() - 20_000));

    await expect(refreshAdminSession()).resolves.toEqual({ status: 'replayed' });
    const statements = mocks.clientQuery.mock.calls.map(([sql]) => String(sql));
    expect(
      mocks.clientQuery.mock.calls.some(([, values]) =>
        Array.isArray(values) ? values.includes('refresh_token_replay') : false
      )
    ).toBe(true);
    expect(
      statements.some(
        sql =>
          sql.includes('UPDATE public.auth_refresh_tokens') &&
          sql.includes('WHERE session_id = $1::uuid')
      )
    ).toBe(true);
    const clearedCookies = mocks.cookieSet.mock.calls.map(([name]) => name);
    expect(clearedCookies).toContain(ADMIN_ACCESS_COOKIE);
    expect(clearedCookies).toContain(ADMIN_REFRESH_COOKIE);
    expect(clearedCookies).toContain(ADMIN_CSRF_COOKIE);
  });
});
