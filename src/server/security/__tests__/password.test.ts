// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

type ScryptCallback = (error: Error | null, key: Buffer) => void;

const cryptoMocks = vi.hoisted(() => ({
  callbacks: [] as ScryptCallback[],
  scrypt: vi.fn(),
}));

vi.mock('node:crypto', async importOriginal => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, scrypt: cryptoMocks.scrypt };
});

describe('password hashing capacity', () => {
  beforeEach(() => {
    vi.resetModules();
    cryptoMocks.callbacks.length = 0;
    cryptoMocks.scrypt.mockReset();
    cryptoMocks.scrypt.mockImplementation((...args: unknown[]) => {
      cryptoMocks.callbacks.push(args.at(-1) as ScryptCallback);
    });
    process.env.PASSWORD_SCRYPT_CONCURRENCY = '1';
    process.env.PASSWORD_SCRYPT_QUEUE_LIMIT = '1';
  });

  it('bounds the waiting queue and transfers a permit without exceeding concurrency', async () => {
    const { hashPassword, PasswordHashBusyError } = await import('../password');

    const first = hashPassword('first long password phrase');
    await vi.waitFor(() => expect(cryptoMocks.scrypt).toHaveBeenCalledTimes(1));
    const second = hashPassword('second long password phrase');
    const rejected = hashPassword('third long password phrase');

    await expect(rejected).rejects.toBeInstanceOf(PasswordHashBusyError);
    expect(cryptoMocks.scrypt).toHaveBeenCalledTimes(1);

    cryptoMocks.callbacks.shift()?.(null, Buffer.alloc(64, 1));
    await expect(first).resolves.toMatch(/^scrypt\$/);
    await vi.waitFor(() => expect(cryptoMocks.scrypt).toHaveBeenCalledTimes(2));

    cryptoMocks.callbacks.shift()?.(null, Buffer.alloc(64, 2));
    await expect(second).resolves.toMatch(/^scrypt\$/);
  });
});
