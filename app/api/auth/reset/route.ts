import { NextResponse } from 'next/server';
import { authService } from '../../../../src/features/auth';
import { ValidationError } from '../../../../src/features/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'E-mail é obrigatório.' },
        { status: 400 }
      );
    }

    await authService.requestPasswordReset(email);

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'Se o e-mail existir, você receberá instruções em breve.',
    });
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error('[Auth] Password reset request error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}
