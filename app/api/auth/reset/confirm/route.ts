import { authService, InvalidTokenError, ValidationError } from '@/src/features/auth';
import { resetPasswordConfirmSchema } from '@/lib/validators';
import {
  AUTH_RATE_LIMITS,
  assertAuthMutationRequest,
  authContext,
  authJson,
  commonAuthError,
  enforceAuthRateLimit,
  parseAuthJson,
} from '../../_http';

export async function POST(request: Request) {
  try {
    assertAuthMutationRequest(request);
    const context = authContext(request);
    await enforceAuthRateLimit(
      'password-reset-confirm',
      'global',
      AUTH_RATE_LIMITS.resetConfirmGlobal
    );
    if (context.ipAddress) {
      await enforceAuthRateLimit(
        'password-reset-confirm',
        `ip:${context.ipAddress}`,
        AUTH_RATE_LIMITS.resetConfirmIp
      );
    }
    const { token, email, emailConfirmationCode, password } = await parseAuthJson(
      request,
      resetPasswordConfirmSchema
    );
    await enforceAuthRateLimit(
      'password-reset-confirm',
      `token:${token}`,
      AUTH_RATE_LIMITS.resetConfirmGlobal
    );
    await authService.resetPassword(token, email, emailConfirmationCode, password);
    return authService.clearSessionCookies(
      authJson({
        success: true,
        message: 'Senha redefinida com sucesso. Faça login novamente.',
      })
    );
  } catch (error: unknown) {
    const common = commonAuthError(error);
    if (common) return common;
    if (error instanceof InvalidTokenError) {
      return authJson({ error: 'Token inválido ou expirado.' }, { status: 400 });
    }
    if (error instanceof ValidationError) {
      return authJson({ error: error.message }, { status: 400 });
    }
    console.error('[Auth] Password reset failed', error);
    return authJson({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
