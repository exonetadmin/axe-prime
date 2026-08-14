import { NextResponse } from 'next/server';
import { authService } from '../../../../../src/features/auth';
import { InvalidTokenError, ValidationError } from '../../../../../src/features/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { password, confirmPassword } = body;

    // Validate passwords match
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'As senhas não conferem.' },
        { status: 400 }
      );
    }

    await authService.resetPassword(token, password);

    return NextResponse.json({
      success: true,
      message: 'Senha redefinida com sucesso.',
    });
  } catch (error: unknown) {
    if (error instanceof InvalidTokenError) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado.' },
        { status: 400 }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error('[Auth] Password reset error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}
