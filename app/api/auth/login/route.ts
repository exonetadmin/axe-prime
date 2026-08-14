import { NextResponse } from 'next/server';
import { authService } from '../../../../src/features/auth';
import {
  InvalidCredentialsError,
  ValidationError,
} from '../../../../src/features/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Use the new auth service
    const authResult = await authService.login({ email, password });

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      user: authResult.user,
    });

    // Attach session cookie
    await authService.attachSessionCookie(response, authResult);

    return response;
  } catch (error: unknown) {
    if (error instanceof InvalidCredentialsError) {
      return NextResponse.json(
        { error: 'E-mail ou senha incorretos.' },
        { status: 401 }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error('[Auth] Login error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}
