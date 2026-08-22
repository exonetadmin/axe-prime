import { redirect } from 'next/navigation';
import { getAdminSession } from '@/src/features/admin/admin.auth';
import { canAccess } from '@/src/features/admin/admin.types';
import AdminModuleGate from '@/app/admin/_components/admin-module-gate';
import { planRequestsRepository } from '@/src/features/plans/plan-requests.repository';
import AdminPlanosClient from './admin-planos-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Planos | Admin AXE PRIME' };

export default async function AdminPlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  if (!canAccess(session.role, 'planos')) {
    return <AdminModuleGate module="planos" title="Planos" />;
  }

  const params = await searchParams;
  const statusFilter = (params?.status ?? 'pending') as 'pending' | 'approved' | 'rejected' | 'all';

  const [{ rows, total }, counts] = await Promise.all([
    planRequestsRepository.listRequests(statusFilter, 60, 0),
    planRequestsRepository.countByStatus(),
  ]);

  return (
    <AdminModuleGate module="planos" title="Planos">
      <AdminPlanosClient
        rows={rows}
        total={total}
        counts={counts}
        statusFilter={statusFilter}
        adminRole={session.role}
      />
    </AdminModuleGate>
  );
}
