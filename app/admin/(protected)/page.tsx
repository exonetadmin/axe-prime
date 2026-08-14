import { getAdminSession } from '@/src/features/admin/admin.auth';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '@/src/features/admin/admin.types';
import {
  Users,
  ArrowDownToLine,
  FileText,
  Network,
  Zap,
  BadgeDollarSign,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { adminRepository } from '@/src/features/admin/admin.repository';

export const dynamic = 'force-dynamic';

type Stat = {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: string;
  deltaUp?: boolean;
  accent: string;
  show?: boolean;
};

export default async function AdminDashboardPage() {
  const session  = (await getAdminSession())!;
  const { role, name } = session;
  const firstName = name.split(' ')[0];
  const roleLabel = ROLE_LABELS[role];
  const modules   = ROLE_PERMISSIONS[role];

  // Fetch true stats
  const dbStats = await adminRepository.getDashboardStats();

  const formatBRL = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

  const STATS: Stat[] = [
    {
      icon: Users,
      label: 'Usuários Ativos',
      value: String(dbStats.activeUsersCount),
      delta: 'cadastros recentes',
      deltaUp: true,
      accent: '#38bdf8',          // --accent
    },
    {
      icon: ArrowDownToLine,
      label: 'Saques Pendentes',
      value: String(dbStats.pendingWithdrawalsCount),
      delta: 'aguardando',
      accent: '#fbbf24',
      show: modules.includes('saques'),
    },
    {
      icon: Zap,
      label: 'PIX a Aprovar',
      value: String(dbStats.pendingPixAprovarCount),
      delta: 'cadastros (KYC)',
      deltaUp: true,
      accent: '#34d399',          // --success
      show: modules.includes('pix'),
    },
    {
      icon: FileText,
      label: 'Volume no Mês',
      value: formatBRL(dbStats.volumeMonthCents),
      delta: 'neste mês',
      deltaUp: true,
      accent: '#7dd3fc',          // --sky
      show: modules.includes('extrato'),
    },
    {
      icon: Network,
      label: 'Membros na Rede',
      value: String(dbStats.networkMembersCount),
      delta: 'total indicado',
      deltaUp: true,
      accent: '#a78bfa',
      show: modules.includes('rede'),
    },
    {
      icon: BadgeDollarSign,
      label: 'Comissões Pagas',
      value: formatBRL(dbStats.paidCommissionsCents),
      delta: 'histórico geral',
      accent: '#0ea5e9',          // --accent-strong
      show: modules.includes('comissoes'),
    },
  ].filter((s) => s.show !== false);

  const now = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="adm-page">

      {/* ── Header ── */}
      <header className="adm-page-header">
        <div>
          <p className="adm-page-kicker">Painel de Controle</p>
          <h1 className="adm-page-title">
            Olá, {firstName}
          </h1>
          <p className="adm-page-sub">
            {now} · Sessão como{' '}
            <strong style={{ color: 'var(--text)' }}>{roleLabel}</strong>
          </p>
        </div>
        <span className="adm-role-badge">{roleLabel}</span>
      </header>

      {/* ── KPI Blocks ── */}
      <section className="adm-stats-grid">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <article key={stat.label} className="adm-stat-card">
              {/* Icon — hex accent garante borderColor válido */}
              <div className="adm-stat-icon" style={{ color: stat.accent, borderColor: `${stat.accent}33` }}>
                <Icon size={16} strokeWidth={1.8} />
              </div>

              {/* Value */}
              <div className="adm-stat-body">
                <p className="adm-stat-value">{stat.value}</p>
                <p className="adm-stat-label">{stat.label}</p>
              </div>

              {/* Delta */}
              {stat.delta && (
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  fontSize: '0.65rem',
                  color: stat.deltaUp ? 'var(--success)' : 'var(--text-soft)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {stat.deltaUp && (
                    <TrendingUp size={10} strokeWidth={1.8} />
                  )}
                  {stat.delta}
                </div>
              )}
            </article>
          );
        })}
      </section>

      {/* ── Módulos Disponíveis ── */}
      <section className="adm-welcome-notice">
        <h2 className="adm-welcome-notice-title">
          Módulos disponíveis · {roleLabel}
        </h2>
        <ul className="adm-welcome-notice-list">
          {modules.map((m) => (
            <li key={m} className="adm-welcome-notice-item">
              <span className="adm-welcome-check">✓</span>
              {m}
            </li>
          ))}
        </ul>
        {role !== 'master' && (
          <p className="adm-welcome-notice-footer">
            Para acesso a outros módulos, solicite ao Master Admin.
          </p>
        )}
      </section>

    </div>
  );
}
