// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('production cookie prefixes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses __Host- for portal cookies and __Secure- for /admin cookies', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();

    const tokens = await import('../tokens');

    expect(tokens.ACCESS_TOKEN_COOKIE).toBe('__Host-axeprime_access_token');
    expect(tokens.REFRESH_TOKEN_COOKIE).toBe('__Host-axeprime_refresh_token');
    expect(tokens.CSRF_TOKEN_COOKIE).toBe('__Host-axeprime_csrf_token');
    expect(tokens.ADMIN_ACCESS_TOKEN_COOKIE).toBe('__Secure-axeprime_admin_access_token');
    expect(tokens.ADMIN_REFRESH_TOKEN_COOKIE).toBe('__Secure-axeprime_admin_refresh_token');
  });
});
