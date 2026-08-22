import {
  authService,
  InvalidTokenError,
  RefreshTokenAlreadyRotatedError,
  RefreshTokenReplayError,
} from '@/src/features/auth';
import { REFRESH_TOKEN_COOKIE } from '@/src/server/security/tokens';
import { assertCsrf, readCookieToken } from '@/src/server/security/request';
import {
  AUTH_RATE_LIMITS,
  authContext,
  authJson,
  commonAuthError,
  enforceAuthRateLimit,
} from '../_http';

export async function POST(request: Request) {
  try {
    assertCsrf(request);
    const refreshToken = readCookieToken(request, REFRESH_TOKEN_COOKIE);
    if (!refreshToken) throw new InvalidTokenError();

    const context = authContext(request);
    await enforceAuthRateLimit('refresh-global', 'all', AUTH_RATE_LIMITS.refreshGlobal);
    await enforceAuthRateLimit('refresh', `token:${refreshToken}`, AUTH_RATE_LIMITS.refreshToken);
    const sessionId = await authService.getRefreshRateLimitSubject(refreshToken);
    if (sessionId) {
      await enforceAuthRateLimit('refresh-session', sessionId, AUTH_RATE_LIMITS.refreshSession);
    }
    if (context.ipAddress) {
      await enforceAuthRateLimit('refresh', `ip:${context.ipAddress}`, AUTH_RATE_LIMITS.refreshIp);
    }

    const result = await authService.refresh(refreshToken);
    const response = authJson({
      success: true,
      user: result.user,
      expiresIn: Math.max(
        0,
        Math.floor((result.accessTokenExpiresAt.getTime() - Date.now()) / 1000)
      ),
      expiresAt: result.accessTokenExpiresAt.toISOString(),
    });
    return authService.attachSessionCookies(response, result);
  } catch (error) {
    const common = commonAuthError(error);
    if (common) return common;
    if (error instanceof RefreshTokenAlreadyRotatedError) {
      return authJson(
        {
          error: 'A sessão já foi renovada por outra solicitação.',
          code: error.code,
        },
        { status: 409, headers: { 'Retry-After': '1' } }
      );
    }
    if (error instanceof InvalidTokenError || error instanceof RefreshTokenReplayError) {
      return authService.clearSessionCookies(
        authJson(
          { error: 'Sessão inválida ou expirada.' },
          {
            status: 401,
            headers: {
              'WWW-Authenticate': 'Bearer realm="axe-prime", error="invalid_token"',
            },
          }
        )
      );
    }
    console.error('[Auth] Refresh failed', error);
    return authJson({ error: 'Erro ao renovar sessão.' }, { status: 500 });
  }
}
