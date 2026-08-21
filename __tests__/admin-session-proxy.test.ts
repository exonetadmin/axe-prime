// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { signAccessToken } from '@/src/server/security/tokens';

describe('admin session proxy flow', () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = Buffer.alloc(32, 11).toString('base64');
    process.env.AUTH_TOKEN_PEPPER = Buffer.alloc(32, 12).toString('base64');
  });

  it('redirects an admin refresh credential to the POST renewal UI', async () => {
    const request = new NextRequest('https://app.axe.example/admin/usuarios?pagina=2', {
      headers: {
        cookie: 'axeprime_admin_refresh_token=opaque-refresh',
      },
    });
    const response = await proxy(request);

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.pathname).toBe('/admin/session/renew');
    expect(location.searchParams.get('next')).toBe('/admin/usuarios?pagina=2');
  });

  it('routes an expired admin access token through explicit refresh rotation', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expiredAccessToken = await new SignJWT({
      sid: '11111111-1111-4111-8111-111111111111',
      principal_type: 'admin',
      ver: 0,
      role: 'master',
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
      .setIssuer('axe-prime')
      .setAudience('axe-prime-api')
      .setSubject('admin-1')
      .setJti('22222222-2222-4222-8222-222222222222')
      .setIssuedAt(now - 1_000)
      .setExpirationTime(now - 30)
      .sign(Buffer.alloc(32, 11));
    const request = new NextRequest('https://app.axe.example/admin/configuracoes', {
      headers: {
        cookie:
          `axeprime_admin_access_token=${expiredAccessToken}; ` +
          'axeprime_admin_refresh_token=opaque-refresh',
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(303);
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe(
      '/admin/session/renew'
    );
  });

  it('allows the renewal page and POST endpoint without an access token', async () => {
    const pageResponse = await proxy(
      new NextRequest('https://app.axe.example/admin/session/renew')
    );
    const endpointResponse = await proxy(
      new NextRequest('https://app.axe.example/admin/session/refresh', {
        method: 'POST',
      })
    );

    expect(pageResponse.headers.get('x-middleware-next')).toBe('1');
    expect(endpointResponse.headers.get('x-middleware-next')).toBe('1');
  });

  it('accepts a valid signed admin access token without renewal', async () => {
    const { token } = await signAccessToken({
      subject: 'admin-1',
      sessionId: '11111111-1111-4111-8111-111111111111',
      principalType: 'admin',
      tokenVersion: 0,
      role: 'master',
    });
    const response = await proxy(
      new NextRequest('https://app.axe.example/admin', {
        headers: {
          cookie: `axeprime_admin_access_token=${token}`,
        },
      })
    );

    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
