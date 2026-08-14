import { NextResponse } from 'next/server';
import { authService } from '../../../../src/features/auth';

export async function POST() {
  try {
    // Logout from service (emits events)
    await authService.logout();

    // Clear session cookie
    const response = NextResponse.json({ success: true });
    authService.clearSessionCookie(response);

    return response;
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    return NextResponse.json(
      { error: 'Erro ao realizar logout.' },
      { status: 500 }
    );
  }
}
