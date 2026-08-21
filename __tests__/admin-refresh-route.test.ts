// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refreshAdminSession: vi.fn(),
  consume: vi.fn(),
}));

vi.mock('@/src/features/admin/admin.auth', () => ({
  ADMIN_CSRF_COOKIE: 'axeprime_admin_csrf_token',
  ADMIN_REFRESH_COOKIE: 'axeprime_admin_refresh_token',
  refreshAdminSession: mocks.refreshAdminSession,
}));

vi.mock('@/src/server/security/rate-limit', () => ({
  authRateLimiter: { consume: mocks.consume },
}));

import { POST } from '@/app/admin/session/refresh/route';
import { createCsrfToken } from '@/src/server/security/tokens';

function refreshRequest(csrf: string, origin = 'https://app.axe.example') {
  return new Request('https://app.axe.example/admin/session/refresh', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'sec-fetch-site': origin === 'https://app.axe.example' ? 'same-origin' : 'cross-site',
      'x-csrf-token': csrf,
      cookie:
        `axeprime_admin_csrf_token=${encodeURIComponent(csrf)}; ` +
        'axeprime_admin_refresh_token=opaque-refresh',
    },
    body: '{}',
  });
}

describe('admin refresh route', () => {
  beforeEach(() => {
    process.env.AUTH_TOKEN_PEPPER = Buffer.alloc(32, 31).toString('base64');
    process.env.AUTH_ALLOWED_ORIGINS = 'https://app.axe.example';
    delete process.env.TRUST_PROXY_HEADERS;
    mocks.refreshAdminSession.mockReset();
    mocks.consume.mockReset();
    mocks.consume.mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterSeconds: 0,
    });
  });

  it('rejects cross-site refresh before touching session state', async () => {
    const response = await POST(refreshRequest(createCsrfToken(), 'https://evil.example'));

    expect(response.status).toBe(403);
    expect(mocks.refreshAdminSession).not.toHaveBeenCalled();
  });

  it('requires the signed double-submit admin CSRF token', async () => {
    const csrf = createCsrfToken();
    const request = refreshRequest(csrf);
    request.headers.delete('x-csrf-token');

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mocks.refreshAdminSession).not.toHaveBeenCalled();
  });

  it('rotates a same-origin session through the protected POST endpoint', async () => {
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    mocks.refreshAdminSession.mockResolvedValue({
      status: 'ok',
      user: {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@axe.example',
        role: 'master',
      },
      accessTokenExpiresAt: expiresAt,
    });

    const response = await POST(refreshRequest(createCsrfToken()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      expiresAt: expiresAt.toISOString(),
    });
    expect(mocks.refreshAdminSession).toHaveBeenCalledOnce();
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('returns 409 without treating a concurrent rotation as a replay', async () => {
    mocks.refreshAdminSession.mockResolvedValue({ status: 'already_rotated' });

    const response = await POST(refreshRequest(createCsrfToken()));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'REFRESH_ALREADY_ROTATED',
    });
    expect(response.headers.get('retry-after')).toBe('1');
  });
});
