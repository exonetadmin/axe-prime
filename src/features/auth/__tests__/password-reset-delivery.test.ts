// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebhookPasswordResetDelivery } from '../services/password-reset-delivery';

describe('WebhookPasswordResetDelivery', () => {
  beforeEach(() => {
    process.env.APP_PUBLIC_URL = 'https://app.axe.example';
    process.env.PASSWORD_RESET_WEBHOOK_URL = 'https://mailer.axe.example/reset';
    process.env.PASSWORD_RESET_WEBHOOK_BEARER_TOKEN = 'b'.repeat(32);
    process.env.AUTH_TOKEN_PEPPER = Buffer.alloc(32, 17).toString('base64');
  });

  afterEach(() => vi.unstubAllGlobals());

  it('keeps the reset credential out of request paths and query strings', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    const token = 'r'.repeat(64);

    await new WebhookPasswordResetDelivery().deliver({
      email: 'user@example.com',
      name: 'User',
      resetToken: token,
      emailConfirmationCode: '123456',
    });

    const requestInit = fetchMock.mock.calls[0]?.[1];
    const payload = JSON.parse(String(requestInit?.body)) as { resetUrl: string };
    const resetUrl = new URL(payload.resetUrl);
    expect(resetUrl.pathname).toBe('/auth');
    expect(resetUrl.searchParams.get('mode')).toBe('new-password');
    expect(resetUrl.searchParams.has('token')).toBe(false);
    expect(new URLSearchParams(resetUrl.hash.slice(1)).get('token')).toBe(token);
  });
});
