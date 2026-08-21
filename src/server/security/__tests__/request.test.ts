// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vitest';
import { createCsrfToken, CSRF_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../tokens';
import {
  assertCsrf,
  assertMutationSecurity,
  assertTrustedMutation,
  getSessionContextFromHeaders,
  parseJsonRequest,
  RequestSecurityError,
} from '../request';

describe('request security', () => {
  beforeEach(() => {
    process.env.AUTH_TOKEN_PEPPER = Buffer.alloc(32, 5).toString('base64');
    process.env.AUTH_ALLOWED_ORIGINS = 'https://app.axe.example';
    delete process.env.TRUST_PROXY_HEADERS;
  });

  it('accepts a same-origin mutation with a signed double-submit token', () => {
    const refresh = 'refresh-session-a';
    const csrf = createCsrfToken(refresh);
    const request = new Request('https://app.axe.example/api/auth/refresh', {
      method: 'POST',
      headers: {
        origin: 'https://app.axe.example',
        'sec-fetch-site': 'same-origin',
        'x-csrf-token': csrf,
        cookie: `${CSRF_TOKEN_COOKIE}=${encodeURIComponent(csrf)}; ${REFRESH_TOKEN_COOKIE}=${refresh}`,
      },
    });
    expect(() => assertCsrf(request)).not.toThrow();
  });

  it('rejects cross-site browser requests', () => {
    const request = new Request('https://app.axe.example/api/auth/logout', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        'sec-fetch-site': 'cross-site',
      },
    });
    expect(() => assertTrustedMutation(request)).toThrow(RequestSecurityError);
  });

  it('rejects a missing CSRF header for cookie-authenticated mutations', () => {
    const refresh = 'refresh-session-a';
    const csrf = createCsrfToken(refresh);
    const request = new Request('https://app.axe.example/api/auth/logout', {
      method: 'POST',
      headers: {
        origin: 'https://app.axe.example',
        cookie: `${CSRF_TOKEN_COOKIE}=${csrf}; ${REFRESH_TOKEN_COOKIE}=${refresh}`,
      },
    });
    expect(() => assertCsrf(request)).toThrow(RequestSecurityError);
  });

  it('supports an isolated, signed CSRF cookie namespace', () => {
    const csrf = createCsrfToken();
    const request = new Request('https://app.axe.example/admin/session/refresh', {
      method: 'POST',
      headers: {
        origin: 'https://app.axe.example',
        'sec-fetch-site': 'same-origin',
        'x-csrf-token': csrf,
        cookie: `axeprime_admin_csrf_token=${encodeURIComponent(csrf)}`,
      },
    });
    expect(() => assertCsrf(request, 'axeprime_admin_csrf_token')).not.toThrow();
  });

  it('does not require a CSRF cookie for explicit Bearer authentication', () => {
    const request = new Request('https://app.axe.example/api/v1/profile', {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer header.payload.signature',
        origin: 'https://app.axe.example',
        'sec-fetch-site': 'same-origin',
      },
    });
    expect(() => assertMutationSecurity(request)).not.toThrow();
  });

  it('ignores proxy IP headers unless explicitly trusted', () => {
    const requestHeaders = new Headers({
      'user-agent': 'unit-test',
      'x-forwarded-for': '203.0.113.8, 10.0.0.1',
      'x-real-ip': '198.51.100.7',
    });
    expect(getSessionContextFromHeaders(requestHeaders)).toMatchObject({
      ipAddress: null,
    });

    process.env.TRUST_PROXY_HEADERS = 'true';
    expect(getSessionContextFromHeaders(requestHeaders)).toMatchObject({
      ipAddress: '203.0.113.8',
    });
  });

  it('maps malformed JSON to a typed 400 security error', async () => {
    const request = new Request('https://app.axe.example/api/v1/profile', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{invalid',
    });
    await expect(parseJsonRequest(request)).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_JSON',
    });
  });

  it('stops reading oversized JSON bodies even without Content-Length', async () => {
    const request = new Request('https://app.axe.example/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'x'.repeat(17_000) }),
    });
    await expect(parseJsonRequest(request)).rejects.toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
  });
});
