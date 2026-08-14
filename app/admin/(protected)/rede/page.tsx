import AdminModuleGate from '@/app/admin/_components/admin-module-gate';
import { adminRepository } from '@/src/features/admin/admin.repository';
import { Network, Users2, UserPlus, Trophy, GitBranch, Layers, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AdminRedeTree } from './admin-rede-tree';

export const dynamic = 'force-dynamic';

export default async function RedePage() {
  return (
    <AdminModuleGate module="rede" title="Rede MLM">
      <RedeContent />
    </AdminModuleGate>
  );
}

async function RedeContent() {
  const [stats, topSponsors30d, roots, totalBases] = await Promise.all([
    adminRepository.getNetworkStats(),
    adminRepository.getTopSponsors30d(10),
    adminRepository.getFullNetworkTree(null),
    adminRepository.countNetworkBases(),
  ]);

  /* ── Métricas derivadas ── */
  const coveragePct = stats.totalUsers > 0
    ? Math.round((stats.withAdhesion / stats.totalUsers) * 100)
    : 0;

  /* Conta nós by levelInBase walking the full tree */
  const levelCounts: Record<number, number> = {};
  let maxGlobalLevel = 0;

  function walkCounts(node: { levelInBase: number; globalLevel: number; children: typeof node[] }) {
    levelCounts[node.levelInBase] = (levelCounts[node.levelInBase] ?? 0) + 1;
    if (node.globalLevel > maxGlobalLevel) maxGlobalLevel = node.globalLevel;
    for (const c of node.children) walkCounts(c);
  }
  for (const root of roots) walkCounts(root);

  return (
    <div className="adm-page">

      {/* ── Header ── */}
      <header className="adm-page-header">
        <div>
          <p className="adm-page-kicker">Crescimento · Rede Unilevel Completa</p>
          <h1 className="adm-page-title">Rede MLM</h1>
          <p className="adm-page-sub">
            {stats.totalUsers} cadastros ·{' '}
            {stats.withSponsor} indicados ·{' '}
            <span style={{ color: 'var(--success)' }}>{stats.withAdhesion} ativos</span>
            {' · '}
            <span style={{ color: 'var(--accent)' }}>{coveragePct}% conversão</span>
          </p>
        </div>
        <span
          className="adm-role-badge"
          style={{ background: 'rgba(167,139,250,0.08)', borderColor: 'rgba(167,139,250,0.2)', color: '#a78bfa' }}
        >
          <Network size={12} strokeWidth={2} />
          {stats.totalUsers} nós · {totalBases} base{totalBases !== 1 ? 's' : ''}
        </span>
      </header>

      {/* ── Stats Grid ── */}
      <div className="adm-stats-grid" style={{ marginBottom: '1.75rem' }}>

        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ color: 'var(--accent)', borderColor: 'rgba(56,189,248,0.2)' }}>
            <Users2 size={14} strokeWidth={1.8} />
          </div>
          <div className="adm-stat-body">
            <p className="adm-stat-value">{stats.totalUsers}</p>
            <p className="adm-stat-label">Total Cadastros</p>
          </div>
        </div>

        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.2)' }}>
            <UserPlus size={14} strokeWidth={1.8} />
          </div>
          <div className="adm-stat-body">
            <p className="adm-stat-value">{stats.withSponsor}</p>
            <p className="adm-stat-label">Indicados</p>
          </div>
        </div>

        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ color: 'var(--success)', borderColor: 'rgba(52,211,153,0.2)' }}>
            <Network size={14} strokeWidth={1.8} />
          </div>
          <div className="adm-stat-body">
            <p className="adm-stat-value">{stats.withAdhesion}</p>
            <p className="adm-stat-label">Com Adesão</p>
          </div>
        </div>

        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.2)' }}>
            <GitBranch size={14} strokeWidth={1.8} />
          </div>
          <div className="adm-stat-body">
            <p className="adm-stat-value">{totalBases}</p>
            <p className="adm-stat-label">Bases de Rede</p>
          </div>
        </div>

        <div className="adm-stat-card">
          <div className="adm-stat-icon" style={{ color: '#f472b6', borderColor: 'rgba(244,114,182,0.2)' }}>
            <Layers size={14} strokeWidth={1.8} />
          </div>
          <div className="adm-stat-body">
            <p className="adm-stat-value">{maxGlobalLevel}</p>
            <p className="adm-stat-label">Profundidade</p>
          </div>
        </div>

      </div>

      {/* ── Árvore + Top Sponsors ── */}
      <div className="adm-rede-layout">

        {/* Árvore completa */}
        <div className="adm-card adm-rede-tree-card">
          <div className="adm-card-head">
            <Network size={14} strokeWidth={1.8} style={{ color: 'var(--accent)' }} />
            <h2 className="adm-card-title">Árvore da Rede — Todos os Níveis</h2>
            <span className="adm-badge" style={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.2)', marginLeft: 'auto', fontSize: '0.7rem' }}>
              {stats.withSponsor} nós · {totalBases} base{totalBases !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Legenda de níveis na base */}
          <div className="adm-rede-legend">
            {([1, 2, 3, 4, 5] as const).map((lvl) => {
              const colors: Record<number, string> = {
                1: 'var(--accent)', 2: '#818cf8', 3: '#a78bfa', 4: '#f472b6', 5: '#f59e0b',
              };
              return (
                <span key={lvl} className="adm-rede-legend-item">
                  <span className="adm-rede-legend-dot" style={{ background: colors[lvl] }} />
                  {lvl}º nível{lvl === 5 && <span style={{ opacity: 0.6, fontSize: '0.6rem' }}> → Nova Base</span>}
                </span>
              );
            })}
            <span className="adm-rede-legend-item" style={{ marginLeft: 'auto' }}>
              <span className="adm-rede-legend-dot adm-rede-legend-dot--newbase" />
              Nova Base
            </span>
          </div>

          {/* Árvore visual interativa */}
          <div className="adm-rede-tree-scroll">
            <AdminRedeTree roots={roots} />
          </div>
        </div>

        {/* Painel lateral */}
        <div className="adm-rede-side">

          {/* Distribuição por nível na base */}
          <div className="adm-card" style={{ marginBottom: '1.25rem' }}>
            <div className="adm-card-head">
              <Layers size={14} strokeWidth={1.8} style={{ color: '#f472b6' }} />
              <h2 className="adm-card-title">Por Nível (na Base)</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
              {([1, 2, 3, 4, 5] as const).map((lvl) => {
                const count = levelCounts[lvl] ?? 0;
                const pct = stats.withSponsor > 0 ? Math.round((count / stats.withSponsor) * 100) : 0;
                const colors: Record<number, string> = {
                  1: 'var(--accent)', 2: '#818cf8', 3: '#a78bfa', 4: '#f472b6', 5: '#f59e0b',
                };
                return (
                  <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '3.5rem', fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'right', flexShrink: 0 }}>
                      {lvl}º nível
                    </span>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: colors[lvl], borderRadius: '4px', transition: 'width 0.4s ease' }} />
                    </div>
                    <span style={{ width: '2.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', textAlign: 'right' }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Top Patrocinadores 30 dias ── */}
          <div className="adm-card">
            <div className="adm-card-head">
              <Trophy size={14} strokeWidth={1.8} style={{ color: '#fbbf24' }} />
              <h2 className="adm-card-title">Top Patrocinadores</h2>
              <span style={{
                marginLeft: 'auto',
                fontSize: '0.6rem',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-soft)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '4px',
                padding: '0.15rem 0.45rem',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>
                30 dias
              </span>
            </div>

            {topSponsors30d.length === 0 ? (
              <p className="adm-table-empty" style={{ padding: '2rem 0' }}>
                Nenhuma indicação nos últimos 30 dias.
              </p>
            ) : (
              <ol style={{ listStyle: 'none', margin: '0.875rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {topSponsors30d.map((s, i) => {
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                  const deltaPositive = s.delta > 0;
                  const deltaNeutral  = s.delta === 0;

                  return (
                    <li
                      key={s.id}
                      style={{
                        background: i < 3
                          ? 'rgba(251,191,36,0.03)'
                          : 'rgba(255,255,255,0.02)',
                        border: '1px solid',
                        borderColor: i < 3
                          ? 'rgba(251,191,36,0.1)'
                          : 'rgba(255,255,255,0.05)',
                        borderRadius: '0.5rem',
                        padding: '0.625rem 0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      {/* Linha 1: rank + nome + delta */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontSize: medal ? '1rem' : '0.7rem',
                          fontWeight: 700,
                          color: '#fbbf24',
                          minWidth: '1.5rem',
                          lineHeight: 1,
                        }}>
                          {medal ?? `#${i + 1}`}
                        </span>

                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: 'var(--text)',
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {s.name}
                        </span>

                        {/* Badge delta vs mês anterior */}
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: deltaNeutral ? 'var(--text-soft)' : deltaPositive ? '#34d399' : '#f87171',
                          background: deltaNeutral
                            ? 'rgba(255,255,255,0.04)'
                            : deltaPositive
                              ? 'rgba(52,211,153,0.08)'
                              : 'rgba(248,113,113,0.08)',
                          border: '1px solid',
                          borderColor: deltaNeutral
                            ? 'rgba(255,255,255,0.08)'
                            : deltaPositive
                              ? 'rgba(52,211,153,0.2)'
                              : 'rgba(248,113,113,0.2)',
                          borderRadius: '999px',
                          padding: '0.1rem 0.45rem',
                          flexShrink: 0,
                        }}>
                          {deltaNeutral
                            ? <Minus size={9} />
                            : deltaPositive
                              ? <TrendingUp size={9} />
                              : <TrendingDown size={9} />}
                          {deltaNeutral ? '=' : deltaPositive ? `+${s.delta}` : s.delta}
                        </span>
                      </div>

                      {/* Linha 2: indicados 30d + total + ativos + conversão */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>

                        {/* Principal: indicados no mês */}
                        <span style={{
                          fontSize: '1.15rem',
                          fontWeight: 700,
                          color: 'var(--accent)',
                          letterSpacing: '-0.03em',
                          lineHeight: 1,
                        }}>
                          {s.referrals30d}
                        </span>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-soft)', lineHeight: 1 }}>
                          no mês
                        </span>

                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.12)' }}>·</span>

                        {/* Total histórico */}
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)' }}>
                          {s.totalReferrals} total
                        </span>

                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.12)' }}>·</span>

                        {/* Ativos */}
                        <span style={{ fontSize: '0.72rem', color: '#34d399' }}>
                          {s.activeReferrals} ativos
                        </span>
                      </div>

                      {/* Linha 3: barra de conversão */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          flex: 1,
                          height: '4px',
                          background: 'rgba(255,255,255,0.06)',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${s.conversionPct}%`,
                            height: '100%',
                            background:
                              s.conversionPct >= 70 ? '#34d399'
                              : s.conversionPct >= 40 ? '#fbbf24'
                              : '#f87171',
                            borderRadius: '4px',
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-soft)', flexShrink: 0, minWidth: '2.5rem', textAlign: 'right' }}>
                          {s.conversionPct}% conv.
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
