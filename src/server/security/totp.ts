import '@/src/server/server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from 'node:crypto';

const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const DEFAULT_TOTP_WINDOW = 1;
const TOTP_ALGORITHM = 'sha1';
const TOTP_SECRET_BYTES = 20;
const TOTP_SECRET_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_SECRET_TO_INT = new Map<string, number>(
  TOTP_SECRET_ALPHABET.split('').map((char, index) => [char, index])
);

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

const TOTP_ISSUER = process.env.ADMIN_TOTP_ISSUER?.trim() || 'AXE PRIME Admin';
const OTP_WINDOW = positiveIntegerEnv('ADMIN_MFA_WINDOW', DEFAULT_TOTP_WINDOW);

function getTotpEncryptionKey(): Buffer {
  const encoded = process.env.ADMIN_TOTP_ENCRYPTION_KEY?.trim();
  if (!encoded) {
    throw new Error('ADMIN_TOTP_ENCRYPTION_KEY environment variable is required');
  }

  const key = Buffer.from(encoded, 'base64');
  if (key.length < 32) {
    throw new Error('ADMIN_TOTP_ENCRYPTION_KEY must be base64-encoded and >= 32 random bytes');
  }

  return key;
}

function normalizeBase32Secret(secret: string): string {
  return secret
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '')
    .replace(/=+/g, '')
    .trim();
}

function assertSecret(secret: string): void {
  if (secret.length < 16 || secret.length > 128) {
    throw new Error('TOTP secret must have length between 16 and 128 characters');
  }
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += TOTP_SECRET_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += TOTP_SECRET_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(secret: string): Buffer {
  const normalized = normalizeBase32Secret(secret);
  assertSecret(normalized);

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const chunk = TOTP_SECRET_TO_INT.get(char);
    if (chunk === undefined) {
      throw new Error('Chave TOTP inválida.');
    }

    value = (value << 5) | chunk;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

function truncateHmac(hash: Buffer): number {
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  return binary % 1_000_000;
}

function counterBuffer(counter: number): Buffer {
  const buffer = Buffer.alloc(8);
  const high = Math.floor(counter / 0x1_0000_0000);
  const low = counter >>> 0;
  buffer.writeUInt32BE(high, 0);
  buffer.writeUInt32BE(low, 4);
  return buffer;
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(TOTP_SECRET_BYTES));
}

export function encodeTotpUri(adminEmail: string, secret: string): string {
  const encodedSecret = normalizeBase32Secret(secret);
  assertSecret(encodedSecret);
  const label = encodeURIComponent(`${TOTP_ISSUER}:${adminEmail}`);
  const issuer = encodeURIComponent(TOTP_ISSUER);

  return `otpauth://totp/${label}?secret=${encodedSecret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

export function generateTotpCode(secret: string, at = Date.now()): string {
  const normalizedSecret = normalizeBase32Secret(secret);
  assertSecret(normalizedSecret);
  const key = base32Decode(normalizedSecret);

  const counter = Math.floor(at / 1000 / TOTP_STEP_SECONDS);
  const counterBuf = counterBuffer(counter);

  const mac = createHmac(TOTP_ALGORITHM, key)
    .update(counterBuf)
    .digest();
  const code = truncateHmac(mac).toString().padStart(TOTP_DIGITS, '0');
  return code.slice(-TOTP_DIGITS);
}

export function verifyTotpToken(
  secret: string,
  token: string,
  at = Date.now(),
  window = OTP_WINDOW
): boolean {
  const trimmed = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(trimmed)) return false;

  const normalizedSecret = normalizeBase32Secret(secret);

  const key = base32Decode(normalizedSecret);
  const step = Math.floor(at / 1000 / TOTP_STEP_SECONDS);
  const tokenWindow = Math.max(0, Math.floor(window));

  const keyMatch = trimToBuffer(trimmed);
  for (let offset = -tokenWindow; offset <= tokenWindow; offset += 1) {
    const expected = generateTotpCodeFromCounter(key, step + offset);
    const expectedBuffer = trimToBuffer(expected);
    if (
      expectedBuffer.length === keyMatch.length &&
      expectedBuffer.length === TOTP_DIGITS &&
      keyMatch.equals(expectedBuffer)
    ) {
      return true;
    }
  }

  return false;
}

function trimToBuffer(value: string): Buffer {
  return Buffer.from(value.trim(), 'utf8');
}

function generateTotpCodeFromCounter(key: Buffer, counter: number): string {
  const mac = createHmac(TOTP_ALGORITHM, key)
    .update(counterBuffer(counter))
    .digest();
  return truncateHmac(mac).toString().padStart(TOTP_DIGITS, '0').slice(-TOTP_DIGITS);
}

export function encryptTotpSecret(secret: string): string {
  const normalized = normalizeBase32Secret(secret);
  assertSecret(normalized);

  const key = getTotpEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const payload = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1.${iv.toString('base64url')}.${payload.toString('base64url')}.${tag.toString('base64url')}`;
}

export function decryptTotpSecret(payload: string | null): string {
  if (!payload) throw new Error('Chave TOTP não configurada.');

  const [version, ivEncoded, ciphertextEncoded, tagEncoded] = payload.split('.');
  if (version !== 'v1' || !ivEncoded || !ciphertextEncoded || !tagEncoded) {
    throw new Error('Formato de chave TOTP inválido.');
  }

  const key = getTotpEncryptionKey();
  const iv = Buffer.from(ivEncoded, 'base64url');
  const ciphertext = Buffer.from(ciphertextEncoded, 'base64url');
  const tag = Buffer.from(tagEncoded, 'base64url');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const output = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  const normalized = output.toString('utf8').toUpperCase();
  return normalizeBase32Secret(normalized);
}

export function randomTotpChallengeId(): string {
  return randomUUID();
}

export function hashTotpChallenge(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
