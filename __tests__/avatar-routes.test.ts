// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  deleteAvatar: vi.fn(),
  getAdminFromBearer: vi.fn(),
  getAdminSession: vi.fn(),
  getAvatar: vi.fn(),
  rateLimitConsume: vi.fn(),
  saveAvatar: vi.fn(),
}));

vi.mock('@/src/features/auth', () => ({
  authService: { authenticateRequest: mocks.authenticateRequest },
}));

vi.mock('@/src/features/admin/admin.auth', () => ({
  getAdminFromBearer: mocks.getAdminFromBearer,
  getAdminSession: mocks.getAdminSession,
}));

vi.mock('@/src/features/profile/profile.repository', () => ({
  profileRepository: {
    deleteAvatar: mocks.deleteAvatar,
    getAvatar: mocks.getAvatar,
    saveAvatar: mocks.saveAvatar,
  },
}));

vi.mock('@/src/server/security/rate-limit', () => ({
  authRateLimiter: { consume: mocks.rateLimitConsume },
}));

import { GET as getAdminAvatar } from '@/app/admin/avatars/[userId]/route';
import { GET as getPortalAvatar } from '@/app/api/v1/avatars/[userId]/route';
import { POST as uploadAvatar } from '@/app/api/v1/profile/avatar/route';

const APP_ORIGIN = 'https://app.axe.example';

function bearerHeaders(): HeadersInit {
  return {
    authorization: 'Bearer header.payload.signature',
    origin: APP_ORIGIN,
    'sec-fetch-site': 'same-origin',
  };
}

function routeContext(userId: string) {
  return { params: Promise.resolve({ userId }) };
}

describe('avatar upload body limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateRequest.mockResolvedValue({ id: 'user-1' });
    mocks.rateLimitConsume.mockResolvedValue({
      allowed: true,
      remaining: 9,
      retryAfterSeconds: 0,
    });
    mocks.saveAvatar.mockResolvedValue('/api/v1/avatars/user-1?v=abc');
  });

  it('accepts a valid multipart upload without Content-Length', async () => {
    const form = new FormData();
    const png = readFileSync(resolve(process.cwd(), 'public/brand/axe-prime-emblem.png'));
    form.set('avatar', new File([png], 'avatar.png', { type: 'image/png' }));
    const request = new Request(`${APP_ORIGIN}/api/v1/profile/avatar`, {
      method: 'POST',
      headers: bearerHeaders(),
      body: form,
    });

    expect(request.headers.get('content-length')).toBeNull();
    const response = await uploadAvatar(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      avatarUrl: '/api/v1/avatars/user-1?v=abc',
    });
    expect(mocks.saveAvatar).toHaveBeenCalledWith('user-1', 'image/png', expect.any(Buffer));
    expect(mocks.rateLimitConsume).toHaveBeenNthCalledWith(
      1,
      'avatar-upload-global',
      'all',
      expect.any(Object)
    );
    expect(mocks.rateLimitConsume).toHaveBeenNthCalledWith(
      2,
      'avatar-upload-user',
      'user-1',
      expect.any(Object)
    );
  });

  it('applies the distributed limiter before consuming the multipart body', async () => {
    mocks.rateLimitConsume.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 45,
    });
    const form = new FormData();
    form.set('avatar', new File(['not-read'], 'avatar.png', { type: 'image/png' }));
    const request = new Request(`${APP_ORIGIN}/api/v1/profile/avatar`, {
      method: 'POST',
      headers: bearerHeaders(),
      body: form,
    });
    const getReader = vi.spyOn(request.body!, 'getReader');

    const response = await uploadAvatar(request);

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('45');
    expect(getReader).not.toHaveBeenCalled();
    expect(mocks.rateLimitConsume).toHaveBeenCalledOnce();
    expect(mocks.saveAvatar).not.toHaveBeenCalled();
  });

  it('cancels an oversized multipart stream even when Content-Length is absent', async () => {
    let emittedChunks = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        emittedChunks += 1;
        controller.enqueue(new Uint8Array(512 * 1024));
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request(`${APP_ORIGIN}/api/v1/profile/avatar`, {
      method: 'POST',
      headers: {
        ...bearerHeaders(),
        'content-type': 'multipart/form-data; boundary=avatar-boundary',
      },
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    expect(request.headers.get('content-length')).toBeNull();
    const response = await uploadAvatar(request);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(cancelled).toBe(true);
    expect(emittedChunks).toBeLessThanOrEqual(12);
    expect(mocks.saveAvatar).not.toHaveBeenCalled();
  });
});

describe('avatar read authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateRequest.mockResolvedValue({ id: 'user-1' });
    mocks.getAdminSession.mockResolvedValue(null);
    mocks.getAdminFromBearer.mockResolvedValue(null);
    mocks.getAvatar.mockResolvedValue({
      content_type: 'image/png',
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      sha256: 'avatar-digest',
      updated_at: new Date(),
    });
  });

  it('advertises Bearer authentication when the portal credential is missing', async () => {
    mocks.authenticateRequest.mockResolvedValue(null);

    const response = await getPortalAvatar(
      new Request(`${APP_ORIGIN}/api/v1/avatars/user-1`),
      routeContext('user-1')
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer realm="axe-prime-api"');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('does not expose another portal user avatar', async () => {
    const response = await getPortalAvatar(
      new Request(`${APP_ORIGIN}/api/v1/avatars/user-2`, { headers: bearerHeaders() }),
      routeContext('user-2')
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.getAvatar).not.toHaveBeenCalled();
  });

  it('serves the authenticated portal user their own avatar', async () => {
    const response = await getPortalAvatar(
      new Request(`${APP_ORIGIN}/api/v1/avatars/user-1`, { headers: bearerHeaders() }),
      routeContext('user-1')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
    expect(response.headers.get('vary')).toContain('Cookie');
    expect(response.headers.get('vary')).toContain('Authorization');
    expect(mocks.getAvatar).toHaveBeenCalledWith('user-1');
  });

  it('supports a canonical encoded legacy TEXT id without broadening access', async () => {
    const legacyId = 'legacy user@example.com';
    mocks.authenticateRequest.mockResolvedValue({ id: legacyId });
    const response = await getPortalAvatar(
      new Request(`${APP_ORIGIN}/api/v1/avatars/${encodeURIComponent(legacyId)}`, {
        headers: bearerHeaders(),
      }),
      routeContext(legacyId)
    );

    expect(response.status).toBe(200);
    expect(mocks.getAvatar).toHaveBeenCalledWith(legacyId);
  });

  it.each(['financeiro', 'suporte'] as const)(
    'rejects an admin with the %s role because it lacks rede permission',
    async role => {
      mocks.getAdminSession.mockResolvedValue({
        id: `admin-${role}`,
        name: role,
        email: `${role}@axe.example`,
        role,
      });

      const response = await getAdminAvatar(
        new Request(`${APP_ORIGIN}/admin/avatars/user-1`),
        routeContext('user-1')
      );

      expect(response.status).toBe(403);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(mocks.getAvatar).not.toHaveBeenCalled();
    }
  );

  it('serves avatars to an admin with rede permission', async () => {
    mocks.getAdminSession.mockResolvedValue({
      id: 'admin-master',
      name: 'Master',
      email: 'master@axe.example',
      role: 'master',
    });

    const response = await getAdminAvatar(
      new Request(`${APP_ORIGIN}/admin/avatars/user-1`),
      routeContext('user-1')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
    expect(mocks.getAvatar).toHaveBeenCalledWith('user-1');
  });

  it('revalidates an authenticated avatar without weakening protected cache headers', async () => {
    mocks.getAdminSession.mockResolvedValue({
      id: 'admin-master',
      name: 'Master',
      email: 'master@axe.example',
      role: 'master',
    });

    const response = await getAdminAvatar(
      new Request(`${APP_ORIGIN}/admin/avatars/user-1`, {
        headers: { 'if-none-match': '"avatar-digest"' },
      }),
      routeContext('user-1')
    );

    expect(response.status).toBe(304);
    expect(response.headers.get('cache-control')).toBe('private, no-cache');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('vary')).toContain('Cookie');
  });
});
