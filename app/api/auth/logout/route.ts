import { authService } from '@/src/features/auth';
import {
  ACCESS_TOKEN_COOKIE,
  readBearerToken,
  REFRESH_TOKEN_COOKIE,
} from '@/src/server/security/tokens';
import { assertMutationSecurity, readCookieToken } from '@/src/server/security/request';
import { authJson, commonAuthError } from '../_http';

export async function POST(request: Request) {
  try {
    assertMutationSecurity(request);
    const bearer = readBearerToken(request);

    await authService.logout({
      accessToken: bearer ?? readCookieToken(request, ACCESS_TOKEN_COOKIE),
      refreshToken: readCookieToken(request, REFRESH_TOKEN_COOKIE),
    });
    return authService.clearSessionCookies(authJson({ success: true }));
  } catch (error) {
    const common = commonAuthError(error);
    if (common) return common;
    console.error('[Auth] Logout failed', error);
    return authJson({ error: 'Erro ao realizar logout.' }, { status: 500 });
  }
}
