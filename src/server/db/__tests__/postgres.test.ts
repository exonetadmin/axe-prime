// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { databaseSslConfiguration } from '../postgres';

describe('PostgreSQL TLS configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('encrypts without validating a self-signed CA in require mode', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_SSL_MODE', 'require');

    expect(databaseSslConfiguration()).toEqual({ rejectUnauthorized: false });
  });

  it('validates the certificate chain in verify-full mode', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_SSL_MODE', 'verify-full');
    vi.stubEnv('DATABASE_CA_CERT', '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----');

    expect(databaseSslConfiguration()).toEqual({
      rejectUnauthorized: true,
      ca: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
    });
  });

  it('continues to reject unencrypted database connections in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_SSL_MODE', 'disable');

    expect(() => databaseSslConfiguration()).toThrow(
      'DATABASE_SSL_MODE=disable is not allowed in production'
    );
  });
});
