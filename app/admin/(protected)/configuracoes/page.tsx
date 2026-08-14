import AdminModuleGate from '@/app/admin/_components/admin-module-gate';
import { getAdminSession } from '@/src/features/admin/admin.auth';
import { configRepository } from '@/src/features/admin/config.repository';
import {
  updatePlanAction,
  updateCommissionConfigAction,
  updateCashbackConfigAction,
  addAdminUserAction,
  updateAdminUserAction,
  deleteAdminUserAction,
} from '@/app/admin/actions';
import {
  PlanEditRow,
  CommissionConfigForm,
  CashbackConfigForm,
  AdminUsersPanel,
} from './config-forms';
import {
  Settings2,
  ShieldCheck,
  GitBranch,
  Percent,
  Users2,
  Lock,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ConfiguracoesPage() {
  return (
    <AdminModuleGate module="configuracoes" title="Configurações">
      <ConfigContent />
    </AdminModuleGate>
  );
}

async function ConfigContent() {
  const session    = await getAdminSession();
  const isMaster   = session?.role === 'master';

  const [plans, commCfg, cashCfg, adminUsers] = await Promise.all([
    configRepository.getPlans(),
    configRepository.getCommissionConfig(),
    configRepository.getCashbackConfig(),
    isMaster ? configRepository.getAdminUsers() : Promise.resolve([]),
  ]);

  const brl = (cents: number) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="adm-page">

      {/* ── Header ── */}
      <header className="adm-page-header">
        <div>
          <p className="adm-page-kicker">Sistema · Configurações Globais</p>
          <h1 className="adm-page-title">Configurações</h1>
          <p className="adm-page-sub">
            Sessão:{' '}
            <strong style={{ color: 'var(--text)' }}>{session?.name}</strong>
            {' '}
            <span className={`adm-badge adm-badge--${isMaster ? 'elite' : 'start'} adm-badge--xs`}>
              {session?.role}
            </span>
            {isMaster && (
              <span style={{ marginLeft: '0.75rem', fontSize: '0.72rem', color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <ShieldCheck size={10} strokeWidth={2} />
                Modo master — edição habilitada
              </span>
            )}
          </p>
        </div>
        <span className="adm-role-badge" style={{
          background: isMaster ? 'rgba(251,191,36,0.08)' : 'rgba(56,189,248,0.06)',
          borderColor: isMaster ? 'rgba(251,191,36,0.2)' : 'rgba(56,189,248,0.15)',
          color: isMaster ? '#fbbf24' : 'var(--text-soft)',
        }}>
          <Settings2 size={12} strokeWidth={2} />
          {isMaster ? 'Master' : 'Leitura'}
        </span>
      </header>

      <div className="adm-cfg-grid">

        {/* ── Planos ── */}
        <section className="adm-card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <GitBranch size={14} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
            <h2 className="adm-card-title" style={{ margin: 0 }}>Planos da Plataforma</h2>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Plano</th>
                  <th>Mensalidade</th>
                  {isMaster && <th>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {plans.map((p) =>
                  isMaster ? (
                    <PlanEditRow key={p.id} plan={p} action={updatePlanAction} />
                  ) : (
                    <tr key={p.id}>
                      <td data-label="Plano">
                        <span className={`adm-badge adm-badge--${p.id}`}>{p.name}</span>
                      </td>
                      <td data-label="Mensalidade" className="adm-table-value">{brl(p.monthly_cents)}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
          {isMaster && (
            <p className="adm-card-note">
              Altere nome e mensalidade de cada plano. Os valores afetam novos cadastros.
            </p>
          )}
        </section>

        {/* ── Comissões ── */}
        <section className="adm-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <GitBranch size={14} strokeWidth={1.8} style={{ color: '#a78bfa' }} />
            <h2 className="adm-card-title" style={{ margin: 0 }}>Regras de Comissão</h2>
          </div>
          {isMaster ? (
            <CommissionConfigForm cfg={commCfg} action={updateCommissionConfigAction} />
          ) : (
            <table className="adm-table">
              <thead>
                <tr><th>Tipo</th><th>%</th></tr>
              </thead>
              <tbody>
                <tr><td className="adm-table-muted">Direto</td><td className="adm-table-value">{commCfg.direct_pct}%</td></tr>
                <tr><td className="adm-table-muted">Nível 1</td><td className="adm-table-value">{commCfg.level1_pct}%</td></tr>
                <tr><td className="adm-table-muted">Nível 2</td><td className="adm-table-value">{commCfg.level2_pct}%</td></tr>
                <tr><td className="adm-table-muted">Nível 3</td><td className="adm-table-value">{commCfg.level3_pct}%</td></tr>
                <tr><td className="adm-table-muted">Nível 4</td><td className="adm-table-value">{commCfg.level4_pct}%</td></tr>
                <tr><td className="adm-table-muted">Nível 5</td><td className="adm-table-value">{commCfg.level5_pct}%</td></tr>
              </tbody>
            </table>
          )}
        </section>

        {/* ── Cashback ── */}
        <section className="adm-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Percent size={14} strokeWidth={1.8} style={{ color: 'var(--success)' }} />
            <h2 className="adm-card-title" style={{ margin: 0 }}>Regras de Cashback</h2>
          </div>
          {isMaster ? (
            <CashbackConfigForm cfg={cashCfg} action={updateCashbackConfigAction} />
          ) : (
            <table className="adm-table">
              <thead>
                <tr><th>Parâmetro</th><th>Valor</th></tr>
              </thead>
              <tbody>
                <tr><td className="adm-table-muted">Padrão</td><td className="adm-table-value">{cashCfg.standard_pct}%</td></tr>
                <tr><td className="adm-table-muted">Premium</td><td className="adm-table-value">{cashCfg.premium_pct}%</td></tr>
                <tr><td className="adm-table-muted">Limite premium</td><td className="adm-table-value">{brl(cashCfg.premium_threshold_cents)}</td></tr>
                <tr><td className="adm-table-muted">Duração</td><td className="adm-table-value">{cashCfg.duration_months} meses</td></tr>
                <tr><td className="adm-table-muted">Crédito</td><td className="adm-table-value">Dia {cashCfg.credit_day}</td></tr>
              </tbody>
            </table>
          )}
        </section>

        {/* ── Administradores (master only) ── */}
        {isMaster && (
          <section className="adm-card" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Users2 size={14} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
              <h2 className="adm-card-title" style={{ margin: 0 }}>Administradores &amp; Cargos</h2>
            </div>
            <AdminUsersPanel
              users={adminUsers}
              currentId={session!.id}
              addAction={addAdminUserAction}
              updateAction={updateAdminUserAction}
              deleteAction={deleteAdminUserAction}
            />
            <div className="adm-card-note" style={{ marginTop: '1rem' }}>
              <strong>Cargos disponíveis:</strong>{' '}
              <span className="adm-badge adm-badge--elite adm-badge--xs">master</span> — acesso total + edição
              {' · '}
              <span className="adm-badge adm-badge--prime adm-badge--xs">financeiro</span> — saques, PIX, extrato
              {' · '}
              <span className="adm-badge adm-badge--start adm-badge--xs">suporte</span> — usuários, dashboard
            </div>
          </section>
        )}

        {!isMaster && (
          <section className="adm-card" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
            <div className="adm-cfg-lock">
              <Lock size={28} strokeWidth={1.4} style={{ color: 'var(--text-soft)', opacity: 0.5 }} />
              <p style={{ color: 'var(--text-soft)', marginTop: '0.75rem', fontSize: '0.82rem' }}>
                Edição de configurações disponível apenas para o <strong>Master Admin</strong>.
              </p>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
