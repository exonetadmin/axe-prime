// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  createWithdrawal: vi.fn(),
  rateLimitConsume: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/src/features/auth', () => ({
  authService: { authenticateRequest: mocks.authenticateRequest },
}));
vi.mock('@/src/features/wallet/wallet.repository', () => {
  class WalletRuleError extends Error {
    constructor(
      readonly code: string,
      message: string
    ) {
      super(message);
    }
  }
  return {
    WalletRuleError,
    walletRepository: { createWithdrawal: mocks.createWithdrawal },
  };
});
vi.mock('@/src/server/security/rate-limit', () => ({
  authRateLimiter: { consume: mocks.rateLimitConsume },
}));

import { POST } from '@/app/api/v1/withdrawals/route';

const APP_ORIGIN = 'https://app.axe.example';

function request(idempotencyKey?: string): Request {
  return new Request(`${APP_ORIGIN}/api/v1/withdrawals`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer header.payload.signature',
      origin: APP_ORIGIN,
      'sec-fetch-site': 'same-origin',
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ amountCents: 10_000 }),
  });
}

describe('withdrawal route security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_TOKEN_PEPPER = Buffer.alloc(32, 71).toString('base64');
    mocks.authenticateRequest.mockResolvedValue({ id: 'user-1' });
    mocks.rateLimitConsume.mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 0,
    });
    mocks.createWithdrawal.mockResolvedValue({ netCents: 9_400, replayed: false });
  });

  it('requires a valid idempotency key before creating a request', async () => {
    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(mocks.rateLimitConsume).not.toHaveBeenCalled();
    expect(mocks.createWithdrawal).not.toHaveBeenCalled();
  });

  it('rate limits a user before processing the financial request', async () => {
    mocks.rateLimitConsume
      .mockResolvedValueOnce({ allowed: true, remaining: 10, retryAfterSeconds: 0 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 90 });

    const response = await POST(request('withdrawal-request-0001'));

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('90');
    expect(mocks.createWithdrawal).not.toHaveBeenCalled();
  });

  it('hashes the key, fingerprints the payload and distinguishes a new request', async () => {
    const response = await POST(request('withdrawal-request-0001'));

    expect(response.status).toBe(201);
    expect(mocks.createWithdrawal).toHaveBeenCalledWith(
      'user-1',
      10_000,
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.stringMatching(/^[0-9a-f]{64}$/)
    );
  });

  it('returns success without creating another row for an idempotent replay', async () => {
    mocks.createWithdrawal.mockResolvedValue({ netCents: 9_400, replayed: true });

    const response = await POST(request('withdrawal-request-0001'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });

  it('advertises Bearer authentication when no principal is present', async () => {
    mocks.authenticateRequest.mockResolvedValue(null);

    const response = await POST(request('withdrawal-request-0001'));

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer realm="axe-prime-api"');
  });
});
