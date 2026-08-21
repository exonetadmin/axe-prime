import { NextResponse } from 'next/server';
import {
  ADMIN_CSRF_COOKIE,
  ADMIN_REFRESH_COOKIE,
  refreshAdminSession,
} from '@/src/features/admin/admin.auth';
import { authRateLimiter } from '@/src/server/security/rate-limit';
import {
  assertCsrf,
  assertJsonRequest,
  getSessionRequestContext,
  noStoreHeaders,
  readCookieToken,
  RequestSecurityError,
} from '@/src/server/security/request';

function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...noStoreHeaders(), ...headers },
  });
}

export async function POST(request: Request) {
  try {
    assertCsrf(request, ADMIN_CSRF_COOKIE);
    assertJsonRequest(request);

    const refreshToken = readCookieToken(request, ADMIN_REFRESH_COOKIE);
    if (!refreshToken) {
      await refreshAdminSession();
      return json({ error: 'Sessão administrativa inválida ou expirada.' }, 401, {
        'WWW-Authenticate': 'Bearer realm="axe-prime-admin", error="invalid_token"',
      });
    }

    const tokenDecision = await authRateLimiter.consume('admin-refresh', `token:${refreshToken}`, {
      limit: 10,
      windowSeconds: 60,
      blockSeconds: 15 * 60,
    });
    const { ipAddress } = getSessionRequestContext(request);
    const ipDecision = ipAddress
      ? await authRateLimiter.consume('admin-refresh', `ip:${ipAddress}`, {
          limit: 120,
          windowSeconds: 60,
          blockSeconds: 5 * 60,
        })
      : null;
    if (!tokenDecision.allowed || (ipDecision && !ipDecision.allowed)) {
      const retryAfter = Math.max(
        tokenDecision.retryAfterSeconds,
        ipDecision?.retryAfterSeconds ?? 0
      );
      return json({ error: 'Muitas tentativas. Aguarde e tente novamente.' }, 429, {
        'Retry-After': String(Math.max(1, retryAfter)),
      });
    }

    const result = await refreshAdminSession();
    if (result.status === 'already_rotated') {
      return json(
        {
          error: 'A sessão já foi renovada por outra requisição.',
          code: 'REFRESH_ALREADY_ROTATED',
        },
        409,
        { 'Retry-After': '1' }
      );
    }
    if (result.status !== 'ok') {
      return json({ error: 'Sessão administrativa inválida ou expirada.' }, 401, {
        'WWW-Authenticate': 'Bearer realm="axe-prime-admin", error="invalid_token"',
      });
    }

    return json({
      success: true,
      expiresAt: result.accessTokenExpiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return json({ error: error.message, code: error.code }, error.status);
    }
    console.error('[Admin Auth] Refresh failed', error);
    return json({ error: 'Erro ao renovar a sessão administrativa.' }, 500);
  }
}
