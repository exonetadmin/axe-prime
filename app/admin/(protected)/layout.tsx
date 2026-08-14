import { redirect } from 'next/navigation';
import { getAdminSession } from '@/src/features/admin/admin.auth';
import AdminSidebar from '@/app/admin/admin-sidebar';
import AdminMobileNav from '@/app/admin/admin-mobile-nav';

export const dynamic = 'force-dynamic';

/**
 * Protected Layout — wraps all admin pages EXCEPT /admin/login.
 * If no valid admin_session cookie → redirect to /admin/login.
 */
export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  if (!session) {
    redirect('/admin/login');
  }

  return (
    <div className="adm-shell">
      {/* Desktop sidebar — hidden on mobile via CSS */}
      <AdminSidebar role={session.role} name={session.name} />

      {/* Mobile topbar + drawer — hidden on desktop via CSS */}
      <AdminMobileNav role={session.role} name={session.name} />

      <div className="adm-content-area">{children}</div>
    </div>
  );
}
