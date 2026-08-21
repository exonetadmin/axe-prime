import '@/src/server/server-only';

import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export const ACCESS_TOKEN_COOKIE = 'axeprime_access_token';
export const REFRESH_TOKEN_COOKIE = 'axeprime_refresh_token';
export const CSRF_TOKEN_COOKIE = 'axeprime_csrf_token';

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export const ACCESS_TOKEN_TTL_SECONDS = positiveIntegerEnv('JWT_ACCESS_TTL_SECONDS', 15 * 60);
export const REFRESH_TOKEN_TTL_SECONDS = positiveIntegerEnv(
  'JWT_REFRESH_TTL_SECONDS',
  30 * 24 * 60 * 60
);
export const PASSWORD_RESET_TTL_SECONDS = positiveIntegerEnv('PASSWORD_RESET_TTL_SECONDS', 60 * 60);

const JWT_ALGORITHM = 'HS256';
const JWT_TYPE = 'at+jwt';
const JWT_ISSUER = process.env.JWT_ISSUER?.trim() || 'axe-prime';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE?.trim() || 'axe-prime-api';

export type AccessTokenPrincipal = {
  subject: string;
  sessionId: string;
  principalType: 'user' | 'admin';
  tokenVersion: number;
  role?: string;
};

export type VerifiedAccessToken = AccessTokenPrincipal & {
  tokenId: string;
  issuedAt: number;
  expiresAt: number;
};

function getSigningKey(): Uint8Array {
  const encoded = process.env.JWT_ACCESS_SECRET?.trim();
  if (!encoded) {
    throw new Error('JWT_ACCESS_SECRET environment variable is required');
  }

  const key = Buffer.from(encoded, 'base64');
  if (key.length < 32) {
    throw new Error(
      'JWT_ACCESS_SECRET must be base64-encoded and contain at least 32 random bytes'
    );
  }
  return key;
}

function getTokenPepper(): Uint8Array {
  const encoded = process.env.AUTH_TOKEN_PEPPER?.trim();
  if (!encoded) {
    throw new Error('AUTH_TOKEN_PEPPER environment variable is required');
  }

  const pepper = Buffer.from(encoded, 'base64');
  if (pepper.length < 32) {
    throw new Error(
      'AUTH_TOKEN_PEPPER must be base64-encoded and contain at least 32 random bytes'
    );
  }
  return pepper;
}

export async function signAccessToken(
  principal: AccessTokenPrincipal
): Promise<{ token: string; expiresAt: Date }> {
  const tokenId = randomUUID();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);
  const token = await new SignJWT({
    sid: principal.sessionId,
    principal_type: principal.principalType,
    ver: principal.tokenVersion,
    ...(principal.role ? { role: principal.role } : {}),
  })
    .setProtectedHeader({ alg: JWT_ALGORITHM, typ: JWT_TYPE })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setSubject(principal.subject)
    .setJti(tokenId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSigningKey());

  return { token, expiresAt };
}

function parsePayload(payload: JWTPayload): VerifiedAccessToken | null {
  if (
    typeof payload.sub !== 'string' ||
    typeof payload.jti !== 'string' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    typeof payload.sid !== 'string' ||
    !Number.isSafeInteger(payload.ver) ||
    (payload.ver as number) < 0 ||
    (payload.principal_type !== 'user' && payload.principal_type !== 'admin')
  ) {
    return null;
  }

  return {
    subject: payload.sub,
    sessionId: payload.sid,
    principalType: payload.principal_type,
    tokenVersion: payload.ver as number,
    role: typeof payload.role === 'string' ? payload.role : undefined,
    tokenId: payload.jti,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  };
}

export async function verifyAccessToken(
  token: string | null | undefined
): Promise<VerifiedAccessToken | null> {
  if (!token) return null;
  try {
    const { payload, protectedHeader } = await jwtVerify(token, getSigningKey(), {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      typ: JWT_TYPE,
      clockTolerance: 5,
      maxTokenAge: `${ACCESS_TOKEN_TTL_SECONDS + 5}s`,
      requiredClaims: ['sub', 'jti', 'iat', 'exp', 'sid', 'principal_type', 'ver'],
    });
    if (protectedHeader.typ !== JWT_TYPE) return null;
    return parsePayload(payload);
  } catch {
    return null;
  }
}

export function createRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHmac('sha256', getTokenPepper())
    .update('axe-prime:opaque-token:v1\0', 'utf8')
    .update(token, 'utf8')
    .digest('hex');
}

/** Compatibilidade de leitura com tokens legados que usavam SHA-256 simples. */
export function hashLegacyOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createCsrfToken(sessionBinding = ''): string {
  const nonce = randomBytes(32).toString('base64url');
  const signature = createHmac('sha256', getTokenPepper())
    .update('axe-prime:csrf:v1\0', 'utf8')
    .update(sessionBinding, 'utf8')
    .update('\0', 'utf8')
    .update(nonce, 'utf8')
    .digest('base64url');
  return `${nonce}.${signature}`;
}

export function verifyCsrfToken(token: string | null | undefined, sessionBinding = ''): boolean {
  if (!token) return false;
  const match = /^([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return false;
  const nonce = match[1];
  const supplied = Buffer.from(match[2], 'base64url');
  if (supplied.toString('base64url') !== match[2]) return false;
  const expected = createHmac('sha256', getTokenPepper())
    .update('axe-prime:csrf:v1\0', 'utf8')
    .update(sessionBinding, 'utf8')
    .update('\0', 'utf8')
    .update(nonce, 'utf8')
    .digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization) return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}
