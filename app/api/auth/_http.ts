import { NextResponse } from 'next/server';
import type { z } from 'zod';
import {
  assertJsonRequest,
  assertRequestBodySize,
  assertTrustedMutation,
  getSessionRequestContext,
  noStoreHeaders,
  parseJsonRequest,
  RequestSecurityError,
} from '@/src/server/security/request';
import { authRateLimiter, type RateLimitPolicy } from '@/src/server/security/rate-limit';
import { PasswordHashBusyError } from '@/src/server/security/password';

function positiveRateLimitEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 600) {
    throw new Error(`${name} must be an integer between 1 and 600`);
  }
  return value;
}

export const AUTH_RATE_LIMITS = {
  loginGlobal: {
    limit: positiveRateLimitEnv('AUTH_LOGIN_GLOBAL_LIMIT', 60),
    windowSeconds: 60,
    blockSeconds: 60,
  },
  loginAccount: { limit: 5, windowSeconds: 15 * 60, blockSeconds: 15 * 60 },
  loginIp: { limit: 30, windowSeconds: 15 * 60, blockSeconds: 15 * 60 },
  registerGlobal: { limit: 30, windowSeconds: 60, blockSeconds: 60 },
  registerAccount: { limit: 3, windowSeconds: 60 * 60, blockSeconds: 60 * 60 },
  registerIp: { limit: 10, windowSeconds: 60 * 60, blockSeconds: 60 * 60 },
  resetGlobal: { limit: 100, windowSeconds: 60, blockSeconds: 60 },
  resetAccount: { limit: 3, windowSeconds: 60 * 60, blockSeconds: 60 * 60 },
  resetIp: { limit: 10, windowSeconds: 60 * 60, blockSeconds: 60 * 60 },
  resetConfirmGlobal: { limit: 300, windowSeconds: 60, blockSeconds: 60 },
  resetConfirmIp: { limit: 20, windowSeconds: 15 * 60, blockSeconds: 15 * 60 },
  refreshToken: { limit: 10, windowSeconds: 60, blockSeconds: 15 * 60 },
  refreshSession: { limit: 10, windowSeconds: 60, blockSeconds: 15 * 60 },
  refreshGlobal: {
    limit: positiveRateLimitEnv('AUTH_REFRESH_GLOBAL_LIMIT', 120),
    windowSeconds: 60,
    blockSeconds: 60,
  },
  refreshIp: { limit: 120, windowSeconds: 60, blockSeconds: 5 * 60 },
} satisfies Record<string, RateLimitPolicy>;

export class AuthInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthInputError';
  }
}

export class AuthRateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('Muitas tentativas. Aguarde e tente novamente.');
    this.name = 'AuthRateLimitError';
  }
}

const MAX_AUTH_JSON_BODY_BYTES = 16 * 1024;

export function assertAuthMutationRequest(request: Request): void {
  assertTrustedMutation(request);
  assertJsonRequest(request);
  assertRequestBodySize(request, MAX_AUTH_JSON_BODY_BYTES);
}

export async function enforceAuthRateLimit(
  action: string,
  identifier: string,
  policy: RateLimitPolicy
): Promise<void> {
  const decision = await authRateLimiter.consume(action, identifier, policy);
  if (!decision.allowed) {
    throw new AuthRateLimitError(decision.retryAfterSeconds);
  }
}

export async function resetAuthRateLimit(action: string, identifier: string): Promise<void> {
  await authRateLimiter.reset(action, identifier);
}

export async function parseAuthJson<Schema extends z.ZodTypeAny>(
  request: Request,
  schema: Schema
): Promise<z.infer<Schema>> {
  assertAuthMutationRequest(request);
  const body = await parseJsonRequest(request, MAX_AUTH_JSON_BODY_BYTES);
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AuthInputError(result.error.issues[0]?.message ?? 'Dados inválidos.');
  }
  return result.data;
}

export function authContext(request: Request) {
  return getSessionRequestContext(request);
}

export function authJson(
  body: unknown,
  init: { status?: number; headers?: HeadersInit } = {}
): NextResponse {
  return NextResponse.json(body, {
    status: init.status,
    headers: { ...noStoreHeaders(), ...init.headers },
  });
}

export function commonAuthError(error: unknown): NextResponse | null {
  if (error instanceof PasswordHashBusyError) {
    return authJson(
      {
        error: 'Serviço de autenticação ocupado. Tente novamente em instantes.',
        code: 'AUTH_BUSY',
      },
      { status: 429, headers: { 'Retry-After': '2' } }
    );
  }
  if (error instanceof AuthRateLimitError) {
    return authJson(
      { error: error.message, code: 'RATE_LIMITED' },
      {
        status: 429,
        headers: { 'Retry-After': String(error.retryAfterSeconds) },
      }
    );
  }
  if (error instanceof AuthInputError) {
    return authJson({ error: error.message }, { status: 400 });
  }
  if (error instanceof RequestSecurityError) {
    return authJson({ error: error.message, code: error.code }, { status: error.status });
  }
  return null;
}
