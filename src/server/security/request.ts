import '@/src/server/server-only';

import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import {
  CSRF_TOKEN_COOKIE,
  readBearerToken,
  REFRESH_TOKEN_COOKIE,
  verifyCsrfToken,
} from './tokens';

export class RequestSecurityError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 413 | 415,
    public readonly code:
      | 'INVALID_ORIGIN'
      | 'INVALID_FETCH_SITE'
      | 'INVALID_CSRF'
      | 'INVALID_JSON'
      | 'PAYLOAD_TOO_LARGE'
      | 'UNSUPPORTED_MEDIA_TYPE'
  ) {
    super(message);
    this.name = 'RequestSecurityError';
  }
}

function isRequestSecurityLoggingEnabled(): boolean {
  const value = process.env.REQUEST_SECURITY_LOG?.trim().toLowerCase();
  if (value === '1' || value === 'true' || value === 'yes' || value === 'on') return true;
  return process.env.NODE_ENV !== 'production';
}

function safeHash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 12);
}

function getRequestIpForSecurityLogging(headers: Pick<Headers, 'get'>): string | null {
  const candidate =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    null;
  return candidate && isIP(candidate) ? candidate : null;
}

function logRequestSecurityRejection(request: Request, error: RequestSecurityError): void {
  if (!isRequestSecurityLoggingEnabled()) return;

  let originUrl: URL | null = null;
  try {
    originUrl = new URL(request.url);
  } catch {
    // keep request context best-effort
  }

  const headers = request.headers;
  const userAgent = headers.get('user-agent');
  const ipAddress =
    process.env.TRUST_PROXY_HEADERS === 'true'
      ? getRequestIpForSecurityLogging(headers)
      : null;

  const allowedOriginsForLog: string[] = [];
  try {
    for (const value of allowedOrigins(request)) {
      allowedOriginsForLog.push(value);
    }
  } catch {
    // If configuration is invalid, keep this empty and rely on application error.
  }

  console.warn('[Security] Request blocked', {
    event: 'request_security_rejection',
    code: error.code,
    status: error.status,
    message: error.message,
    method: request.method,
    pathname: originUrl?.pathname ?? null,
    host: originUrl?.host ?? null,
    origin: headers.get('origin') ?? null,
    referer: headers.get('referer') ?? null,
    secFetchSite: headers.get('sec-fetch-site'),
    secFetchMode: headers.get('sec-fetch-mode'),
    secFetchDest: headers.get('sec-fetch-dest'),
    userAgentHash: userAgent ? safeHash(userAgent) : null,
    ipAddress,
    hasCookie: headers.has('cookie'),
    hasCsrfHeader: headers.has('x-csrf-token'),
    bearerPresent: (headers.get('authorization') ?? '').toLowerCase().startsWith('bearer '),
    allowedOrigins: allowedOriginsForLog,
  });
}

function throwSecurityError(
  request: Request,
  message: string,
  status: 400 | 403 | 413 | 415,
  code: 'INVALID_ORIGIN' | 'INVALID_FETCH_SITE' | 'INVALID_CSRF' | 'INVALID_JSON' | 'PAYLOAD_TOO_LARGE' | 'UNSUPPORTED_MEDIA_TYPE'
): never {
  const error = new RequestSecurityError(message, status, code);
  logRequestSecurityRejection(request, error);
  throw error;
}

function allowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>([new URL(request.url).origin]);
  for (const value of (process.env.AUTH_ALLOWED_ORIGINS ?? '').split(',')) {
    const origin = value.trim();
    if (!origin) continue;
    try {
      origins.add(new URL(origin).origin);
    } catch {
      throw new Error(`Invalid AUTH_ALLOWED_ORIGINS entry: ${origin}`);
    }
  }
  return origins;
}

/** Reject browser cross-site mutations while still allowing non-browser clients. */
export function assertTrustedMutation(request: Request): void {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throwSecurityError(request, 'Cross-site request rejected', 403, 'INVALID_FETCH_SITE');
  }

  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins(request).has(origin)) {
    throwSecurityError(request, 'Origin not allowed', 403, 'INVALID_ORIGIN');
  }
}

export function assertJsonRequest(request: Request): void {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    throwSecurityError(
      request,
      'Content-Type must be application/json',
      415,
      'UNSUPPORTED_MEDIA_TYPE'
    );
  }
}

export function assertRequestBodySize(request: Request, maximumBytes: number): void {
  const raw = request.headers.get('content-length');
  if (!raw) return;
  if (!/^[0-9]+$/.test(raw) || Number(raw) > maximumBytes) {
    throwSecurityError(request, 'Request body is too large', 413, 'PAYLOAD_TOO_LARGE');
  }
}

/**
 * Consume a request body with an application-level ceiling. Content-Length is
 * only an early rejection hint: chunked clients and untrusted proxies can omit
 * it, so the stream itself must always be counted.
 */
export async function readRequestBodyWithLimit(
  request: Request,
  maximumBytes: number
): Promise<Buffer> {
  assertRequestBodySize(request, maximumBytes);
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throwSecurityError(request, 'Request body is too large', 413, 'PAYLOAD_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

export async function parseJsonRequest(
  request: Request,
  maximumBytes = 16 * 1024
): Promise<unknown> {
  assertJsonRequest(request);
  try {
    const body = await readRequestBodyWithLimit(request, maximumBytes);
    return JSON.parse(body.toString('utf8')) as unknown;
  } catch (error) {
    if (error instanceof RequestSecurityError) throw error;
    throwSecurityError(request, 'Invalid JSON body', 400, 'INVALID_JSON');
  }
}

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const raw = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function sameSecret(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertCsrf(request: Request, cookieName = CSRF_TOKEN_COOKIE): void {
  assertTrustedMutation(request);
  const cookieToken = readCookie(request, cookieName);
  const sessionBinding =
    cookieName === CSRF_TOKEN_COOKIE ? (readCookie(request, REFRESH_TOKEN_COOKIE) ?? '') : '';
  const headerToken = request.headers.get('x-csrf-token');
  if (
    !cookieToken ||
    !headerToken ||
    !sameSecret(cookieToken, headerToken) ||
    !verifyCsrfToken(cookieToken, sessionBinding)
  ) {
    throwSecurityError(request, 'CSRF validation failed', 403, 'INVALID_CSRF');
  }
}

/**
 * Browser cookie authentication uses signed double-submit CSRF. A caller that
 * explicitly presents a Bearer credential is not ambiently authenticated, so
 * Origin/Fetch Metadata validation is sufficient for that transport.
 */
export function assertMutationSecurity(request: Request): void {
  assertTrustedMutation(request);
  if (!readBearerToken(request)) assertCsrf(request);
}

export function readCookieToken(request: Request, name: string): string | null {
  return readCookie(request, name);
}

type HeaderReader = Pick<Headers, 'get'>;

export function getSessionContextFromHeaders(requestHeaders: HeaderReader): {
  userAgentHash: string | null;
  ipAddress: string | null;
} {
  const userAgent = requestHeaders.get('user-agent');
  const userAgentHash = userAgent
    ? createHash('sha256').update(userAgent, 'utf8').digest('hex')
    : null;

  if (process.env.TRUST_PROXY_HEADERS !== 'true') {
    return { userAgentHash, ipAddress: null };
  }

  const candidate =
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    requestHeaders.get('x-real-ip')?.trim() ||
    null;
  return {
    userAgentHash,
    ipAddress: candidate && isIP(candidate) ? candidate : null,
  };
}

export function getSessionRequestContext(request: Request): {
  userAgentHash: string | null;
  ipAddress: string | null;
} {
  return getSessionContextFromHeaders(request.headers);
}

export function noStoreHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  };
}
