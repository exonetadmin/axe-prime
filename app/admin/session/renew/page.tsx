import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_CSRF_COOKIE, ADMIN_REFRESH_COOKIE } from '@/src/features/admin/admin.auth';
import { verifyCsrfToken } from '@/src/server/security/tokens';
import AdminSessionRenew from './admin-session-renew';

export const dynamic = 'force-dynamic';

function safeAdminNextPath(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith('/admin') || candidate.startsWith('//')) {
    return '/admin';
  }
  try {
    const parsed = new URL(candidate, 'https://admin-navigation.invalid');
    if (
      parsed.origin !== 'https://admin-navigation.invalid' ||
      (parsed.pathname !== '/admin' && !parsed.pathname.startsWith('/admin/'))
    ) {
      return '/admin';
    }
    if (parsed.pathname === '/admin/login' || parsed.pathname.startsWith('/admin/session/')) {
      return '/admin';
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return '/admin';
  }
}

export default async function AdminSessionRenewPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const jar = await cookies();
  const csrfToken = jar.get(ADMIN_CSRF_COOKIE)?.value;
  const refreshToken = jar.get(ADMIN_REFRESH_COOKIE)?.value;
  if (!csrfToken || !verifyCsrfToken(csrfToken) || !refreshToken) {
    redirect('/admin/login');
  }
  const nextPath = safeAdminNextPath((await searchParams).next);
  return <AdminSessionRenew csrfToken={csrfToken} nextPath={nextPath} />;
}
