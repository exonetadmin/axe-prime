import AdminModuleGate from '@/app/admin/_components/admin-module-gate';
import { getAdminSession } from '@/src/features/admin/admin.auth';
import { configRepository } from '@/src/features/admin/config.repository';
import AdminSegurancaClient from './admin-seguranca-client';

export const dynamic = 'force-dynamic';

export default async function SegurancaPage() {
  return (
    <AdminModuleGate module="seguranca" title="Segurança" description="Autenticação e hardening do painel">
      <SegurancaContent />
    </AdminModuleGate>
  );
}

async function SegurancaContent() {
  const session = await getAdminSession();
  const mfaState = await configRepository.getSelfAdminMfaState(session?.id ?? '');

  return (
    <div className="adm-page">
      <header className="adm-page-header">
        <div>
          <p className="adm-page-kicker">Painel Administrativo</p>
          <h1 className="adm-page-title">Segurança</h1>
          <p className="adm-page-sub">Gerencie a autenticação em duas etapas do seu acesso administrativo.</p>
        </div>
      </header>

      <AdminSegurancaClient mfaEnabled={Boolean(mfaState?.mfaEnabled)} />
    </div>
  );
}
