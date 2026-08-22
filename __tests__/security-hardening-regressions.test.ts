// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig from '@/next.config';
import { isValidBrazilianDate, isValidCpf } from '@/src/shared/validation/brasil';

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('security hardening regressions', () => {
  it('does not expose browser access tokens in auth JSON bodies', () => {
    for (const route of [
      'app/api/auth/login/route.ts',
      'app/api/auth/register/route.ts',
      'app/api/auth/refresh/route.ts',
    ]) {
      expect(source(route)).not.toMatch(/\baccessToken\s*:/);
      expect(source(route)).not.toMatch(/\btokenType\s*:/);
    }
  });

  it('ships global anti-sniffing, anti-framing and CSP headers', async () => {
    const rules = await nextConfig.headers?.();
    const headers = new Map(rules?.[0]?.headers.map(header => [header.key, header.value]));

    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Content-Security-Policy')).toContain("object-src 'none'");
    expect(headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

  it('validates CPF check digits and real calendar dates', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('529.982.247-24')).toBe(false);
    expect(isValidBrazilianDate('29/02/2024')).toBe(true);
    expect(isValidBrazilianDate('31/02/2024')).toBe(false);
    expect(isValidBrazilianDate('01/01/1800')).toBe(false);
  });

  it('keeps the financial audit table append-only for the runtime role', () => {
    const runner = source('scripts/migrate-postgres.mjs');
    expect(runner).toContain('REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER');
    expect(runner).toContain('GRANT SELECT, INSERT ON TABLE public.security_audit_events');
  });
});
