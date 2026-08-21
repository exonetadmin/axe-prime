import '@/src/server/server-only';

import bcrypt from 'bcryptjs';
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 2 ** 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 256 * 1024 * 1024;
const SALT_LENGTH = 16;
const SCRYPT_CONCURRENCY = (() => {
  const raw = process.env.PASSWORD_SCRYPT_CONCURRENCY?.trim() || '2';
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new Error('PASSWORD_SCRYPT_CONCURRENCY must be a positive integer');
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value > 8) {
    throw new Error('PASSWORD_SCRYPT_CONCURRENCY must be between 1 and 8');
  }
  return value;
})();
const SCRYPT_QUEUE_LIMIT = (() => {
  const raw = process.env.PASSWORD_SCRYPT_QUEUE_LIMIT?.trim() || '8';
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new Error('PASSWORD_SCRYPT_QUEUE_LIMIT must be a positive integer');
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value > 64) {
    throw new Error('PASSWORD_SCRYPT_QUEUE_LIMIT must be between 1 and 64');
  }
  return value;
})();

export class PasswordHashBusyError extends Error {
  constructor() {
    super('Password hashing capacity is temporarily exhausted');
    this.name = 'PasswordHashBusyError';
  }
}

let activeScryptOperations = 0;
const scryptWaiters: Array<() => void> = [];

async function acquireScryptPermit(): Promise<() => void> {
  if (activeScryptOperations < SCRYPT_CONCURRENCY) {
    activeScryptOperations += 1;
  } else {
    if (scryptWaiters.length >= SCRYPT_QUEUE_LIMIT) throw new PasswordHashBusyError();
    await new Promise<void>(resolve => scryptWaiters.push(resolve));
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = scryptWaiters.shift();
    if (next) {
      // Transfer the permit directly so a new caller cannot race ahead of the
      // queued operation and exceed the configured concurrency.
      next();
    } else {
      activeScryptOperations -= 1;
    }
  };
}

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  n: number,
  r: number,
  p: number
): Promise<Buffer> {
  return acquireScryptPermit().then(
    release =>
      new Promise((resolve, reject) => {
        try {
          nodeScrypt(
            password,
            salt,
            keyLength,
            { N: n, r, p, maxmem: SCRYPT_MAX_MEMORY },
            (error, key) => {
              release();
              if (error) reject(error);
              else resolve(key);
            }
          );
        } catch (error) {
          release();
          reject(error);
        }
      })
  );
}

async function compareBcrypt(password: string, encodedHash: string): Promise<boolean> {
  const release = await acquireScryptPermit();
  try {
    return await bcrypt.compare(password, encodedHash);
  } finally {
    release();
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await deriveKey(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_N, SCRYPT_R, SCRYPT_P);

  return [
    'scrypt',
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString('base64url'),
    hash.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  if (encodedHash.startsWith('$2')) {
    return compareBcrypt(password, encodedHash);
  }

  const [algorithm, nRaw, rRaw, pRaw, saltRaw, hashRaw] = encodedHash.split('$');
  if (algorithm !== 'scrypt' || !nRaw || !rRaw || !pRaw || !saltRaw || !hashRaw) {
    return false;
  }

  const n = Number.parseInt(nRaw, 10);
  const r = Number.parseInt(rRaw, 10);
  const p = Number.parseInt(pRaw, 10);
  if (
    ![n, r, p].every(Number.isSafeInteger) ||
    n < 2 ** 14 ||
    n > SCRYPT_N ||
    (n & (n - 1)) !== 0 ||
    r <= 0 ||
    r > SCRYPT_R ||
    p <= 0 ||
    p > SCRYPT_P
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(saltRaw, 'base64url');
    const expected = Buffer.from(hashRaw, 'base64url');
    if (salt.length < SALT_LENGTH || expected.length !== SCRYPT_KEY_LENGTH) {
      return false;
    }
    const actual = await deriveKey(password, salt, expected.length, n, r, p);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch (error) {
    if (error instanceof PasswordHashBusyError) throw error;
    return false;
  }
}

export function passwordNeedsRehash(encodedHash: string): boolean {
  if (encodedHash.startsWith('$2')) return true;
  const [algorithm, nRaw, rRaw, pRaw] = encodedHash.split('$');
  return (
    algorithm !== 'scrypt' ||
    Number.parseInt(nRaw ?? '', 10) !== SCRYPT_N ||
    Number.parseInt(rRaw ?? '', 10) !== SCRYPT_R ||
    Number.parseInt(pRaw ?? '', 10) !== SCRYPT_P
  );
}
