import { authService } from '@/src/features/auth';
import { authJson } from '../_http';

export async function GET(request: Request) {
  try {
    const user = await authService.authenticateRequest(request);
    if (!user) {
      return authJson(
        { error: 'Não autenticado' },
        {
          status: 401,
          headers: { 'WWW-Authenticate': 'Bearer realm="axe-prime"' },
        }
      );
    }
    return authJson({ user });
  } catch (error) {
    console.error('[Auth] Session lookup failed', error);
    return authJson({ error: 'Erro ao verificar sessão.' }, { status: 500 });
  }
}
