import { authService, PasswordResetUnavailableError, ValidationError } from '@/src/features/auth';
import { resetRequestSchema } from '@/lib/validators';
import {
  AUTH_RATE_LIMITS,
  assertAuthMutationRequest,
  authContext,
  authJson,
  commonAuthError,
  enforceAuthRateLimit,
  parseAuthJson,
} from '../_http';

export async function POST(request: Request) {
  try {
    assertAuthMutationRequest(request);
    const context = authContext(request);
    await enforceAuthRateLimit('password-reset-request', 'global', AUTH_RATE_LIMITS.resetGlobal);
    if (context.ipAddress) {
      await enforceAuthRateLimit(
        'password-reset-request',
        `ip:${context.ipAddress}`,
        AUTH_RATE_LIMITS.resetIp
      );
    }
    const { email } = await parseAuthJson(request, resetRequestSchema);
    await enforceAuthRateLimit(
      'password-reset-request',
      `account:${email.trim().toLowerCase()}`,
      AUTH_RATE_LIMITS.resetAccount
    );
    await authService.requestPasswordReset(email);
    return authJson(
      {
        success: true,
        message: 'Se o e-mail existir, você receberá instruções em breve.',
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    const common = commonAuthError(error);
    if (common) return common;
    if (error instanceof PasswordResetUnavailableError) {
      return authJson(
        {
          error: 'Recuperação de senha temporariamente indisponível.',
          code: error.code,
        },
        { status: 503, headers: { 'Retry-After': '300' } }
      );
    }
    if (error instanceof ValidationError) {
      return authJson({ error: error.message }, { status: 400 });
    }
    console.error('[Auth] Password reset request failed', error);
    return authJson({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
