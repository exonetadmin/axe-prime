import '@/src/server/server-only';

import { hashOpaqueToken } from '@/src/server/security/tokens';

export type PasswordResetDeliveryInput = {
  email: string;
  name: string;
  resetToken: string;
  emailConfirmationCode: string;
};

export interface PasswordResetDelivery {
  isConfigured(): boolean;
  deliver(input: PasswordResetDeliveryInput): Promise<void>;
}

function configuredHttpsUrl(name: string): URL {
  const raw = process.env[name]?.trim();
  if (!raw) throw new Error(`${name} environment variable is required`);
  const url = new URL(raw);
  if (url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS`);
  }
  return url;
}

/**
 * Delivers reset links to a trusted mail/notification service over HTTPS.
 * The raw credential exists only in memory and in this encrypted transport.
 */
export class WebhookPasswordResetDelivery implements PasswordResetDelivery {
  isConfigured(): boolean {
    try {
      configuredHttpsUrl('PASSWORD_RESET_WEBHOOK_URL');
      configuredHttpsUrl('APP_PUBLIC_URL');
      return (process.env.PASSWORD_RESET_WEBHOOK_BEARER_TOKEN?.trim().length ?? 0) >= 32;
    } catch {
      return false;
    }
  }

  async deliver(input: PasswordResetDeliveryInput): Promise<void> {
    const webhookUrl = configuredHttpsUrl('PASSWORD_RESET_WEBHOOK_URL');
    const publicUrl = configuredHttpsUrl('APP_PUBLIC_URL');
    const bearer = process.env.PASSWORD_RESET_WEBHOOK_BEARER_TOKEN?.trim();
    if (!bearer || bearer.length < 32) {
      throw new Error('PASSWORD_RESET_WEBHOOK_BEARER_TOKEN must have at least 32 characters');
    }

    const resetUrl = new URL('/auth', publicUrl);
    resetUrl.searchParams.set('mode', 'new-password');
    // Fragments are not sent to the web server, CDN, or reverse-proxy access
    // logs. The client immediately removes it from browser history after read.
    resetUrl.hash = new URLSearchParams({ token: input.resetToken }).toString();

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': hashOpaqueToken(input.resetToken),
      },
      body: JSON.stringify({
        event: 'password_reset_requested',
        recipient: { email: input.email, name: input.name },
        resetUrl: resetUrl.toString(),
        emailConfirmationCode: input.emailConfirmationCode,
      }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Password reset delivery failed with status ${response.status}`);
    }
  }
}

export const passwordResetDelivery = new WebhookPasswordResetDelivery();
