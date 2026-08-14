import { NextResponse } from 'next/server';
import { authService } from '../../../../src/features/auth';

export async function GET() {
  try {
    const user = await authService.getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('[Auth] Session error:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar sessão.' },
      { status: 500 }
    );
  }
}
