import { authService } from '@/src/features/auth';
import { EmailExistsError, InvalidReferralCodeError, ValidationError } from '@/src/features/auth';
import { registerSchema } from '@/lib/validators';
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

export async function POST(request: Request) {
  try {
    assertAuthMutationRequest(request);
    const context = authContext(request);
    await enforceAuthRateLimit('register', 'global', AUTH_RATE_LIMITS.registerGlobal);
    if (context.ipAddress) {
      await enforceAuthRateLimit(
        'register',
        `ip:${context.ipAddress}`,
        AUTH_RATE_LIMITS.registerIp
      );
    }
    const data = await parseAuthJson(request, registerSchema);
    const accountKey = data.email.trim().toLowerCase();
    await enforceAuthRateLimit(
      'register',
      `account:${accountKey}`,
      AUTH_RATE_LIMITS.registerAccount
    );
    const result = await authService.register(data, context);
    await resetAuthRateLimit('register', `account:${accountKey}`);
    const response = authJson(
      {
        success: true,
        message: 'Cadastro realizado com sucesso.',
        user: result.user,
        accessToken: result.accessToken,
        tokenType: 'Bearer',
        expiresIn: Math.max(
          0,
          Math.floor((result.accessTokenExpiresAt.getTime() - Date.now()) / 1000)
        ),
        expiresAt: result.accessTokenExpiresAt.toISOString(),
      },
      { status: 201 }
    );
    return authService.attachSessionCookies(response, result);
  } catch (error: unknown) {
    const common = commonAuthError(error);
    if (common) return common;
    if (error instanceof EmailExistsError) {
      return authJson({ error: 'Este e-mail já está cadastrado.' }, { status: 409 });
    }
    if (error instanceof InvalidReferralCodeError || error instanceof ValidationError) {
      return authJson({ error: error.message }, { status: 400 });
    }
    console.error('[Auth] Registration failed', error);
    return authJson({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
