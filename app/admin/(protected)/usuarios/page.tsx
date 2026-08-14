import AdminModuleGate from '@/app/admin/_components/admin-module-gate';
import { EditUserButton } from '@/app/admin/_components/edit-user-button';
import { CreateUserButton } from '@/app/admin/_components/create-user-button';
import { adminRepository } from '@/src/features/admin/admin.repository';
import { configRepository } from '@/src/features/admin/config.repository';
import type { PlanDefaults } from '@/app/admin/_components/admin-edit-user-modal';
import {
  Users,
  Search,
  Star,
  UserCheck,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function fmt(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const search = sp.search ?? '';
  const page = Math.max(1, Number(sp.page ?? '1'));
  const limit = 20;
  const offset = (page - 1) * limit;

  return (
    <AdminModuleGate module="usuarios" title="Usuários">
      <UsuariosContent search={search} page={page} limit={limit} offset={offset} />
    </AdminModuleGate>
  );
}

const PLAN_META: Record<string, { label: string; color: string }> = {
  start:    { label: 'Start',    color: 'var(--sky)'     },
  prime:    { label: 'Prime',    color: 'var(--accent)'  },
  elite:    { label: 'Elite',    color: '#a78bfa'         },
  sem_plano:{ label: 'Sem Plano',color: 'var(--text-soft)'},
};

const CAREER_META: Record<string, { label: string }> = {
  vendedor_elite: { label: 'AP' },
  supervisor:     { label: 'ADV' },
  gestor:         { label: 'GES' },
  gerente_senior: { label: 'GS' },
  diretor_geral:  { label: 'DG' },
};

async function UsuariosContent({
  search,
  page,
  limit,
  offset,
}: {
  search: string;
  page: number;
  limit: number;
  offset: number;
}) {
  const [{ rows, total }, planCounts, activeCount, plans, cashCfg] = await Promise.all([
    adminRepository.listUsers(search, limit, offset),
    adminRepository.countUsersByPlan(),
    adminRepository.countActiveUsers(),
    configRepository.getPlans(),
    configRepository.getCashbackConfig(),
  ]);
  const totalPages  = Math.ceil(total / limit);

  // Constrói mapa tierName → valores-padrão para auto-preenchimento do modal
  // Nome do plano no banco ex: "Start", "Prime", "Elite" → chave lowercase = tier
  const planDefaults: PlanDefaults = Object.fromEntries(
    plans.map((p) => [
      p.name.toLowerCase(),
      { monthlyCents: p.monthly_cents, adhesionCents: 0 },
    ])
  );

  return (
    <div className="adm-page">

      {/* ── Header ── */}
      <header className="adm-page-header">
        <div>
          <p className="adm-page-kicker">Gestão de Membros</p>
          <h1 className="adm-page-title">Usuários</h1>
          <p className="adm-page-sub">
            <strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{total}</strong>
            {' '}cadastros ·{' '}
            <span style={{ color: 'var(--success)' }}>
              <UserCheck size={11} strokeWidth={2} style={{ verticalAlign: 'middle', marginBottom: '1px', marginRight: '2px' }} />
              {activeCount} ativos este mês
            </span>
          </p>
        </div>
        <span className="adm-role-badge" style={{ background: 'rgba(56,189,248,0.08)', borderColor: 'rgba(56,189,248,0.2)', color: 'var(--accent)' }}>
          <Users size={12} strokeWidth={2} />
          {total} membros
        </span>
      </header>

      {/* ── Plano breakdown ── */}
      <div className="adm-stats-grid" style={{ marginBottom: '1.75rem' }}>
        {planCounts.map((p) => {
          const meta = PLAN_META[p.plan] ?? PLAN_META.sem_plano;
          return (
            <div key={p.plan} className="adm-stat-card" style={{ position: 'relative' }}>
              <div className="adm-stat-icon" style={{ color: meta.color, borderColor: `${meta.color}22` }}>
                <Star size={14} strokeWidth={1.8} />
              </div>
              <div className="adm-stat-body">
                <p className="adm-stat-value">{p.count}</p>
                <p className="adm-stat-label">{p.plan === 'sem_plano' ? meta.label : `Plano ${meta.label}`}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Search + Novo Usuário ── */}
      <div className="adm-toolbar">
        <form
          method="GET"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, flexWrap: 'wrap', minWidth: 0 }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
            <Search size={13} strokeWidth={1.5} style={{
              position: 'absolute', left: '0.9rem', top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-soft)', pointerEvents: 'none',
            }} />
            <input
              name="search"
              defaultValue={search}
              placeholder="Buscar por nome, e-mail ou código…"
              className="adm-input"
              style={{ paddingLeft: '2.5rem', width: '100%' }}
            />
          </div>
          <button type="submit" className="adm-btn adm-btn--primary" style={{ flexShrink: 0 }}>Buscar</button>
          {search && (
            <a href="/admin/usuarios" className="adm-btn adm-btn--ghost" style={{ flexShrink: 0 }}>Limpar</a>
          )}
        </form>
        <CreateUserButton />
      </div>



      {/* ── Tabela ── */}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
          <tr>
              <th>Membro</th>
              <th className="adm-col--hide-md adm-col--hide-lg">Código</th>
              <th className="adm-col--hide-md adm-col--hide-lg">Telefone</th>
              <th>Plano</th>
              <th className="adm-col--hide-md adm-col--hide-lg">Cashback</th>
              <th>Investimento</th>
              <th>Mensalidade</th>
              <th className="adm-col--hide-lg">Adesão Paga</th>
              <th>Status Mens.</th>
              <th>Cadastro</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="adm-table-empty">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              rows.map((u) => {
                const meta = PLAN_META[u.plan_interest ?? 'sem_plano'] ?? PLAN_META.sem_plano;
                return (
                  <tr key={u.id}>
                    <td data-label="Membro">
                      <div className="adm-table-name">
                        <span className="adm-table-name__text">{u.name}</span>
                        {u.is_active === false && (
                          <span className="adm-table-name-badge" title="Usuário desativado" style={{
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            color: '#f87171',
                            border: '1px solid rgba(248,113,113,0.3)',
                            borderRadius: '3px',
                            padding: '1px 5px',
                            letterSpacing: '0.05em',
                            background: 'rgba(248,113,113,0.07)',
                          }}>
                            OFF
                          </span>
                        )}
                        {u.career && CAREER_META[u.career] && (
                          <span className="adm-table-name-badge" title={`Carreira: ${CAREER_META[u.career]?.label}`} style={{
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            color: '#a78bfa',
                            border: '1px solid rgba(167,139,250,0.3)',
                            borderRadius: '3px',
                            padding: '1px 5px',
                            letterSpacing: '0.05em',
                            background: 'rgba(167,139,250,0.07)',
                          }}>
                            {CAREER_META[u.career]?.label.split(' ')[0]}
                          </span>
                        )}
                      </div>
                      <div className="adm-table-muted">{u.email}</div>
                    </td>
                    <td data-label="Código" className="adm-col--hide-md adm-col--hide-lg">
                      {u.referral_code
                        ? <code className="adm-code">{u.referral_code}</code>
                        : <span className="adm-table-muted">—</span>}
                    </td>
                    <td data-label="Telefone" className="adm-col--hide-md adm-col--hide-lg">
                      {u.phone
                        ? <span style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{u.phone}</span>
                        : <span className="adm-table-muted">—</span>}
                    </td>
                    <td data-label="Plano">
                      <span
                        className={`adm-badge adm-badge--${u.plan_interest ?? 'none'}`}
                        style={{ color: meta.color, borderColor: `${meta.color}30` }}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td data-label="Cashback" className="adm-table-muted adm-col--hide-md adm-col--hide-lg">
                      {u.monthly_status === 'overdue' ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.2rem', whiteSpace: 'nowrap',
                          fontSize: '0.62rem', fontWeight: 700, color: '#f87171',
                          border: '1px solid rgba(248,113,113,0.3)', borderRadius: '3px',
                          padding: '2px 6px', letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}>
                          🔒 Bloqueado
                        </span>
                      ) : (
                        <>{u.cashback_pct ?? cashCfg.standard_pct}%</>
                      )}
                    </td>
                    <td data-label="Investimento" className="adm-table-muted">
                      {u.adhesion_value_cents ? fmt(u.adhesion_value_cents) : '—'}
                    </td>
                    <td data-label="Mensalidade">
                      {u.plan_monthly_cents ? (
                        <span className="adm-table-value">{fmt(u.plan_monthly_cents)}</span>
                      ) : '—'}
                    </td>
                    <td data-label="Adesão Paga" className="adm-col--hide-lg">
                      {u.adhesion_paid === true ? (
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, color: '#34d399',
                          border: '1px solid rgba(52,211,153,0.3)', borderRadius: '3px',
                          padding: '2px 6px', letterSpacing: '0.04em',
                        }}>SIM</span>
                      ) : (
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, color: '#f87171',
                          border: '1px solid rgba(248,113,113,0.3)', borderRadius: '3px',
                          padding: '2px 6px', letterSpacing: '0.04em',
                        }}>NÃO</span>
                      )}
                    </td>
                    <td data-label="Status Mens.">
                      {(u.adhesion_value_cents ?? 0) > 0 ? (
                        u.monthly_status === 'paid' ? (
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 700, color: '#34d399',
                            border: '1px solid rgba(52,211,153,0.3)', borderRadius: '3px',
                            padding: '2px 6px', letterSpacing: '0.04em',
                          }}>PAGA</span>
                        ) : u.monthly_status === 'overdue' ? (
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 700, color: '#fbbf24',
                            border: '1px solid rgba(251,191,36,0.3)', borderRadius: '3px',
                            padding: '2px 6px', letterSpacing: '0.04em',
                          }}>ATRASADO</span>
                        ) : (
                          <span className="adm-table-muted">—</span>
                        )
                      ) : (
                        <span className="adm-table-muted">—</span>
                      )}
                    </td>
                    <td data-label="Cadastro" className="adm-table-muted">
                      {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <EditUserButton
                        user={{
                          id: u.id,
                          name: u.name,
                          plan_interest: u.plan_interest,
                          cashback_pct: u.cashback_pct,
                          adhesion_value_cents: u.adhesion_value_cents,
                          plan_monthly_cents: u.plan_monthly_cents,
                          is_active: u.is_active ?? null,
                          career: u.career ?? null,
                          adhesion_paid: u.adhesion_paid ?? null,
                          monthly_status: u.monthly_status ?? null,
                        }}
                        planDefaults={planDefaults}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="adm-table-meta">
        {total} registros · pág. {page} de {Math.max(1, totalPages)}
      </p>

      {/* ── Paginação ── */}
      {totalPages > 1 && (
        <div className="adm-pagination">
          {page > 1 && (
            <a href={`/admin/usuarios?search=${search}&page=${page - 1}`} className="adm-btn adm-btn--ghost">
              ← Anterior
            </a>
          )}
          <span className="adm-pagination-info">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a href={`/admin/usuarios?search=${search}&page=${page + 1}`} className="adm-btn adm-btn--ghost">
              Próxima →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
