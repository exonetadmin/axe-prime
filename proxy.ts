import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  verifyAccessToken,
} from '@/src/server/security/tokens';

function loginRedirect(request: NextRequest, admin: boolean): NextResponse {
  const target = request.nextUrl.clone();
  target.pathname = admin ? '/admin/login' : '/auth';
  target.search = '';
  target.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(target);
}

function adminSessionRenewalRedirect(request: NextRequest): NextResponse {
  const target = request.nextUrl.clone();
  const returnPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  target.pathname = '/admin/session/renew';
  target.search = '';
  target.searchParams.set('next', returnPath);
  // Force a GET even when an expired token was discovered on a Server Action
  // POST. The renewal page performs the state-changing rotation via protected
  // POST after it has loaded.
  return NextResponse.redirect(target, 303);
}

/**
 * Fast cryptographic gate. Server layouts and API handlers perform the
 * authoritative database-backed session and role validation.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const admin = pathname.startsWith('/admin');
  if (
    admin &&
    (pathname === '/admin/login' ||
      pathname === '/admin/session/renew' ||
      pathname === '/admin/session/refresh')
  ) {
    return NextResponse.next();
  }

  const accessCookie = admin ? ADMIN_ACCESS_TOKEN_COOKIE : ACCESS_TOKEN_COOKIE;
  const refreshCookie = admin ? ADMIN_REFRESH_TOKEN_COOKIE : REFRESH_TOKEN_COOKIE;
  const accessToken = request.cookies.get(accessCookie)?.value;
  const refreshToken = request.cookies.get(refreshCookie)?.value;
  if (!accessToken) {
    if (admin && refreshToken) return adminSessionRenewalRedirect(request);
    // User refresh remains resolved by the dedicated user auth flow. The
    // opaque token is never validated in proxy middleware.
    return refreshToken ? NextResponse.next() : loginRedirect(request, admin);
  }

  const principal = await verifyAccessToken(accessToken);
  if (!principal) {
    if (admin && refreshToken) return adminSessionRenewalRedirect(request);
    return refreshToken ? NextResponse.next() : loginRedirect(request, admin);
  }
  const expectedType = admin ? 'admin' : 'user';
  if (principal.principalType !== expectedType) {
    return loginRedirect(request, admin);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/portal/:path*', '/admin/:path*'],
};
