import { authService } from '@/src/features/auth';
import {
  AccountDisabledError,
  InvalidCredentialsError,
  ValidationError,
} from '@/src/features/auth';
import { loginSchema } from '@/lib/validators';
import {
  AUTH_RATE_LIMITS,
  assertAuthMutationRequest,
  authContext,
  authJson,
  commonAuthError,
  enforceAuthRateLimit,
  parseAuthJson,
  resetAuthRateLimit,
} from '../_http';
import { tryRecordSecurityAuditEvent } from '@/src/server/security/audit-log';

export async function POST(request: Request) {
  try {
    assertAuthMutationRequest(request);
    const context = authContext(request);
    await enforceAuthRateLimit('login', 'global', AUTH_RATE_LIMITS.loginGlobal);
    if (context.ipAddress) {
      await enforceAuthRateLimit('login', `ip:${context.ipAddress}`, AUTH_RATE_LIMITS.loginIp);
    }
    const credentials = await parseAuthJson(request, loginSchema);
    const accountKey = credentials.email.trim().toLowerCase();
    await enforceAuthRateLimit('login', `account:${accountKey}`, AUTH_RATE_LIMITS.loginAccount);
    const result = await authService.login(credentials, context);
    await resetAuthRateLimit('login', `account:${accountKey}`);
    const response = authJson({
      success: true,
      user: result.user,
      expiresIn: Math.max(
        0,
        Math.floor((result.accessTokenExpiresAt.getTime() - Date.now()) / 1000)
      ),
      expiresAt: result.accessTokenExpiresAt.toISOString(),
    });
    const responseWithCookies = await authService.attachSessionCookies(response, result);
    await tryRecordSecurityAuditEvent({
      category: 'authentication',
      action: 'user_login',
      outcome: 'success',
      actorType: 'user',
      actorId: result.user.id,
      subjectType: 'auth_session',
      subjectId: result.sessionId,
    });
    return responseWithCookies;
  } catch (error: unknown) {
    const common = commonAuthError(error);
    if (common) return common;
    if (error instanceof InvalidCredentialsError) {
      await tryRecordSecurityAuditEvent({
        category: 'authentication',
        action: 'user_login',
        outcome: 'failure',
        actorType: 'anonymous',
      });
      return authJson({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
    }
    if (error instanceof AccountDisabledError) {
      await tryRecordSecurityAuditEvent({
        category: 'authentication',
        action: 'user_login_disabled',
        outcome: 'denied',
        actorType: 'anonymous',
      });
      return authJson({ error: 'Esta conta está desativada.' }, { status: 403 });
    }
    if (error instanceof ValidationError) {
      return authJson({ error: error.message }, { status: 400 });
    }
    console.error('[Auth] Login failed', error);
    return authJson({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
