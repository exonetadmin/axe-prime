import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_CSRF_COOKIE, getAdminSessionState } from '@/src/features/admin/admin.auth';
import AdminSidebar from '@/app/admin/admin-sidebar';
import AdminMobileNav from '@/app/admin/admin-mobile-nav';
import AdminSessionKeeper from '@/app/admin/_components/admin-session-keeper';

export const dynamic = 'force-dynamic';

/**
 * Protected Layout — wraps all admin pages EXCEPT /admin/login.
 * Sem uma sessão administrativa válida, redireciona para o login.
 */
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const sessionState = await getAdminSessionState();

  if (!sessionState) {
    redirect('/admin/login');
  }
  const { user: session, accessTokenExpiresAt } = sessionState;
  const csrfToken = (await cookies()).get(ADMIN_CSRF_COOKIE)?.value;

  return (
    <div className="adm-shell">
      {csrfToken && (
        <AdminSessionKeeper
          csrfToken={csrfToken}
          accessTokenExpiresAt={accessTokenExpiresAt.getTime()}
        />
      )}
      {/* Desktop sidebar — hidden on mobile via CSS */}
      <AdminSidebar role={session.role} name={session.name} />

      {/* Mobile topbar + drawer — hidden on desktop via CSS */}
      <AdminMobileNav role={session.role} name={session.name} />

      <div className="adm-content-area">{children}</div>
    </div>
  );
}
