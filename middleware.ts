import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE = 'axeprime_session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only enforce on portal pages EXCEPT /portal/planos (to avoid loop)
  if (!pathname.startsWith('/portal') || pathname.startsWith('/portal/planos')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.next();

  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) return NextResponse.next();

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    const userId = payload.sub;
    if (!userId) return NextResponse.next();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return NextResponse.next();

    // Check if user has an approved plan — the real gate
    const res = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=plan_interest`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) return NextResponse.next();

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const hasPlan = data[0].plan_interest != null && data[0].plan_interest !== '';
      if (!hasPlan) {
        const url = request.nextUrl.clone();
        url.pathname = '/portal/planos';
        return NextResponse.redirect(url);
      }
    }
  } catch {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/portal/:path*'],
};
