'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  Phone,
  Briefcase,
  MapPin,
  DollarSign,
  Eye,
  User,
  Calendar,
  CreditCard,
  Home,
  Mail,
  Wallet,
  Users,
} from 'lucide-react';
import type { PlanRequestRow, PlanRequestStatus } from '@/src/features/plans/plan-requests.repository';
import { approvePlanRequestAction, rejectPlanRequestAction } from '../../actions';
import type { AdminRole } from '@/src/features/admin/admin.types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtCents(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const PLAN_META: Record<string, { label: string; color: string }> = {
  start: { label: 'Start', color: 'var(--sky)'      },
  prime: { label: 'Prime', color: 'var(--accent)'   },
  elite: { label: 'Elite', color: '#a78bfa'          },
};

const STATUS_META: Record<PlanRequestStatus, { label: string; badge: string; icon: React.ReactNode }> = {
  pending:  { label: 'Pendente',  badge: 'adm-badge adm-badge--warning', icon: <Clock    size={11} strokeWidth={2} /> },
  approved: { label: 'Aprovado',  badge: 'adm-badge adm-badge--success', icon: <CheckCircle size={11} strokeWidth={2} /> },
  rejected: { label: 'Rejeitado', badge: 'adm-badge adm-badge--danger',  icon: <XCircle  size={11} strokeWidth={2} /> },
};

// ── RejectModal ────────────────────────────────────────────────────────────────

function RejectModal({ id, onDone, onCancel }: { id: string; onDone: () => void; onCancel: () => void }) {
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) { setError('Informe o motivo da rejeição.'); return; }
    startTransition(async () => {
      const res = await rejectPlanRequestAction(id, note);
      if (res.error) setError(res.error);
      else onDone();
    });
  }

  return (
    /* Overlay full-screen com z-index garantido */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(3, 11, 19, 0.80)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Caixa do modal — fundo opaco explícito */}
      <div style={{
        background: '#07121f',
        border: '1px solid rgba(103, 196, 243, 0.18)',
        borderRadius: '1rem',
        width: 'min(440px, 100%)',
        maxHeight: 'calc(100dvh - 3rem)',
        overflow: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(56,189,248,0.06)',
        color: '#f3f9fd',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid rgba(103, 196, 243, 0.12)',
        }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f3f9fd' }}>
            Rejeitar solicitação
          </h3>
          <button
            onClick={onCancel}
            aria-label="Fechar"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(163, 178, 195, 0.82)',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              width: 28,
              height: 28,
              fontSize: '0.9rem',
              transition: 'color 0.15s, background 0.15s',
            }}
          >✕</button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.7rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'rgba(163, 178, 195, 0.82)',
              marginBottom: '0.5rem',
            }}>
              Motivo da rejeição *
            </label>
            <textarea
              autoFocus
              placeholder="Descreva o motivo..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                background: 'rgba(7, 20, 31, 0.95)',
                border: '1px solid rgba(103, 196, 243, 0.18)',
                borderRadius: '0.5rem',
                color: '#f3f9fd',
                padding: '0.75rem',
                fontSize: '0.875rem',
                resize: 'vertical',
                outline: 'none',
                lineHeight: 1.6,
                fontFamily: 'inherit',
                minHeight: 100,
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(56, 189, 248, 0.5)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(103, 196, 243, 0.18)')}
            />
          </div>

          {error && (
            <p style={{
              margin: '0 0 0.75rem',
              fontSize: '0.78rem',
              color: '#f87171',
              background: 'rgba(248, 113, 113, 0.08)',
              border: '1px solid rgba(248, 113, 113, 0.2)',
              borderRadius: '0.4rem',
              padding: '0.5rem 0.75rem',
            }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                padding: '0.6rem 1rem',
                background: 'transparent',
                border: '1px solid rgba(103, 196, 243, 0.18)',
                borderRadius: '0.5rem',
                color: 'rgba(163, 178, 195, 0.82)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
                transition: 'border-color 0.15s, color 0.15s',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                flex: 1,
                padding: '0.6rem 1rem',
                background: isPending ? 'rgba(220, 38, 38, 0.5)' : 'rgba(220, 38, 38, 0.85)',
                border: '1px solid rgba(248, 113, 113, 0.25)',
                borderRadius: '0.5rem',
                color: '#fff',
                cursor: isPending ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'background 0.15s',
              }}
            >
              {isPending ? 'Rejeitando…' : 'Confirmar rejeição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── KycDetailModal ───────────────────────────────────────────────────────────────────

const kycFieldStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '0.15rem',
};
const kycFieldLabelStyle: React.CSSProperties = {
  fontSize: '0.6rem', color: 'rgba(163,178,195,0.7)',
  textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
};
const kycFieldValueStyle: React.CSSProperties = {
  fontSize: '0.82rem', color: '#f3f9fd', fontWeight: 500,
};

function KycField({ label, value, icon }: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
}) {
  return (
    <div style={kycFieldStyle}>
      <span style={kycFieldLabelStyle}>{label}</span>
      <span style={{ ...kycFieldValueStyle, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        {icon}
        {value || (
          <span style={{ ...kycFieldValueStyle, color: 'rgba(163,178,195,0.4)' }}>—</span>
        )}
      </span>
    </div>
  );
}

function KycDetailModal({ row, onClose }: { row: PlanRequestRow; onClose: () => void }) {
  const sectionStyle: React.CSSProperties = {
    marginBottom: '1.25rem',
  };
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '0.6rem', fontWeight: 700, color: '#38bdf8',
    textTransform: 'uppercase', letterSpacing: '0.12em',
    marginBottom: '0.625rem', paddingBottom: '0.375rem',
    borderBottom: '1px solid rgba(56,189,248,0.15)',
    display: 'flex', alignItems: 'center', gap: '0.35rem',
  };
  const fieldRowStyle: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: '0.5rem 1.25rem', marginBottom: '0.5rem',
  };
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(3,11,19,0.82)', backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#07121f', border: '1px solid rgba(103,196,243,0.18)',
        borderRadius: '1rem', width: 'min(560px, 100%)',
        maxHeight: 'calc(100dvh - 3rem)', overflow: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(56,189,248,0.06)',
        color: '#f3f9fd',
      }}>
        {/* Accent line */}
        <div style={{
          position: 'absolute', top: 0, left: '10%', right: '10%', height: '2px',
          background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)',
          borderRadius: '1px',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid rgba(103,196,243,0.12)',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#f3f9fd' }}>
              Dados do Cadastro
            </h3>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: 'rgba(163,178,195,0.7)' }}>
              {row.user_name} · {row.user_email}
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(163,178,195,0.82)', padding: '0.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '50%', width: 28, height: 28, fontSize: '0.9rem',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem' }}>

          {/* Identificação */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <User size={11} strokeWidth={2} />
              Identificação
            </div>
            <div style={fieldRowStyle}>
              <KycField label="Nome Completo" value={row.full_name} />
              <KycField label="CPF" value={row.cpf} icon={<CreditCard size={10} strokeWidth={2} />} />
            </div>
            <div style={fieldRowStyle}>
              <KycField label="RG" value={row.rg} />
              <KycField label="Data de Emissão" value={row.rg_issue_date} icon={<Calendar size={10} strokeWidth={2} />} />
            </div>
            <div style={fieldRowStyle}>
              <KycField label="Órgão Emissor" value={row.rg_issuer} />
              <KycField label="Data de Nascimento" value={row.birth_date} icon={<Calendar size={10} strokeWidth={2} />} />
            </div>
            <div style={fieldRowStyle}>
              <KycField label="Estado Civil" value={
                row.marital_status
                  ? { solteiro: 'Solteiro(a)', casado: 'Casado(a)', divorciado: 'Divorciado(a)', viuvo: 'Viúvo(a)', separado: 'Separado(a)', uniao_estavel: 'União Estável' }[row.marital_status] ?? row.marital_status
                  : null
              } />
              <div />
            </div>
          </div>

          {/* Naturalidade */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <MapPin size={11} strokeWidth={2} />
              Naturalidade
            </div>
            <div style={fieldRowStyle}>
              <KycField label="UF" value={row.birth_state} />
              <KycField label="Cidade" value={row.birth_city} />
            </div>
          </div>

          {/* Filiação */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <Users size={11} strokeWidth={2} />
              Filiação
            </div>
            <div style={fieldRowStyle}>
              <KycField label="Nome do Pai" value={row.father_name} />
              <KycField label="Nome da Mãe" value={row.mother_name} />
            </div>
          </div>

          {/* Profissional */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <Briefcase size={11} strokeWidth={2} />
              Profissional
            </div>
            <div style={fieldRowStyle}>
              <KycField label="Profissão" value={row.profession} />
              <KycField label="Renda Mensal" value={row.monthly_income_cents ? fmtCents(row.monthly_income_cents) : null} icon={<DollarSign size={10} strokeWidth={2} />} />
            </div>
            <div style={fieldRowStyle}>
              <KycField label="Patrimônio" value={row.patrimony_cents ? fmtCents(row.patrimony_cents) : null} icon={<Wallet size={10} strokeWidth={2} />} />
              <div />
            </div>
          </div>

          {/* Endereço */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <Home size={11} strokeWidth={2} />
              Endereço
            </div>
            <div style={{ ...kycFieldStyle, marginBottom: '0.5rem' }}>
              <span style={kycFieldLabelStyle}>Logradouro</span>
              <span style={kycFieldValueStyle}>
                {[row.address_street, row.address_number, row.address_complement].filter(Boolean).join(', ') || '—'}
              </span>
            </div>
            <div style={fieldRowStyle}>
              <KycField label="Cidade" value={row.address_city} />
              <KycField label="UF" value={row.address_state} />
            </div>
            <div style={fieldRowStyle}>
              <KycField label="CEP" value={row.address_cep} />
              <div />
            </div>
          </div>

          {/* Contato */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              <Phone size={11} strokeWidth={2} />
              Contato
            </div>
            <div style={fieldRowStyle}>
              <KycField label="Celular" value={row.phone} icon={<Phone size={10} strokeWidth={2} />} />
              <KycField label="E-mail" value={row.email} icon={<Mail size={10} strokeWidth={2} />} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Main Client ────────────────────────────────────────────────────────────────

type Props = {
  rows: PlanRequestRow[];
  total: number;
  counts: Record<PlanRequestStatus, number>;
  statusFilter: PlanRequestStatus | 'all';
  adminRole: AdminRole;
};

const FILTERS: { label: string; value: PlanRequestStatus | 'all'; color: string; bg: string }[] = [
  { label: 'Pendentes',  value: 'pending',  color: '#f59e0b', bg: 'rgba(245,158,11,0.10)'  },
  { label: 'Aprovados',  value: 'approved', color: '#22c55e', bg: 'rgba(34,197,94,0.10)'   },
  { label: 'Rejeitados', value: 'rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.10)'   },
  { label: 'Todos',      value: 'all',      color: 'var(--accent)', bg: 'rgba(56,189,248,0.08)' },
];

export default function AdminPlanosClient({ rows, total, counts, statusFilter, adminRole }: Props) {
  const router = useRouter();
  const [approving, startApprove] = useTransition();
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [kycDetail, setKycDetail] = useState<PlanRequestRow | null>(null);

  function switchFilter(v: PlanRequestStatus | 'all') {
    router.push(`/admin/planos?status=${v}`);
  }

  function handleApprove(id: string) {
    startApprove(async () => {
      await approvePlanRequestAction(id);
      router.refresh();
    });
  }

  const canAct = ['master', 'financeiro'].includes(adminRole);

  return (
    <>
      {rejectTarget && (
        <RejectModal
          id={rejectTarget}
          onDone={() => { setRejectTarget(null); router.refresh(); }}
          onCancel={() => setRejectTarget(null)}
        />
      )}
      {kycDetail && (
        <KycDetailModal
          row={kycDetail}
          onClose={() => setKycDetail(null)}
        />
      )}

      <div className="adm-page">

        {/* ── Header ── */}
        <header className="adm-page-header">
          <div>
            <p className="adm-page-kicker">Gestão de Membros</p>
            <h1 className="adm-page-title">Planos</h1>
            <p className="adm-page-sub">
              <strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{total}</strong>
              {' '}solicitações no total
            </p>
          </div>
          <span className="adm-role-badge" style={{ background: 'rgba(56,189,248,0.08)', borderColor: 'rgba(56,189,248,0.2)', color: 'var(--accent)' }}>
            <ClipboardList size={12} strokeWidth={2} />
            {counts.pending} pendente{counts.pending !== 1 ? 's' : ''}
          </span>
        </header>

        {/* ── Stats ── */}
        <div className="adm-stats-grid" style={{ marginBottom: '1.75rem' }}>
          <div className="adm-stat-card">
            <div className="adm-stat-icon" style={{ color: 'var(--warning)', borderColor: 'rgba(245,158,11,0.2)' }}>
              <Clock size={14} strokeWidth={1.8} />
            </div>
            <div className="adm-stat-body">
              <p className="adm-stat-value">{counts.pending}</p>
              <p className="adm-stat-label">Pendentes</p>
            </div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-icon" style={{ color: 'var(--success)', borderColor: 'rgba(34,197,94,0.2)' }}>
              <CheckCircle size={14} strokeWidth={1.8} />
            </div>
            <div className="adm-stat-body">
              <p className="adm-stat-value">{counts.approved}</p>
              <p className="adm-stat-label">Aprovados</p>
            </div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-icon" style={{ color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}>
              <XCircle size={14} strokeWidth={1.8} />
            </div>
            <div className="adm-stat-body">
              <p className="adm-stat-value">{counts.rejected}</p>
              <p className="adm-stat-label">Rejeitados</p>
            </div>
          </div>
        </div>

        {/* ── Filter tabs ── */}
        <div className="adm-tabs" style={{ marginBottom: '1.25rem' }}>
          {FILTERS.map((f) => {
            const count = f.value !== 'all' ? counts[f.value as PlanRequestStatus] : total;
            const isActive = statusFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => switchFilter(f.value)}
                className={`adm-tab${isActive ? ' adm-tab--active' : ''}`}
                style={isActive ? {
                  color: f.color,
                  background: f.bg,
                  borderColor: `${f.color}40`,
                } : undefined}
              >
                {f.label}
                <span style={{
                  marginLeft: '0.35rem',
                  opacity: isActive ? 0.9 : 0.5,
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: isActive ? f.color : undefined,
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* ── Table ── */}
        {rows.length === 0 ? (
          <div className="adm-table-empty" style={{ padding: '3rem', textAlign: 'center' }}>
            Nenhuma solicitação encontrada.
          </div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Membro</th>
                  <th>Tipo</th>
                  <th>Plano</th>
                  <th>Aporte / mês</th>
                  <th>KYC</th>
                  <th>Status</th>
                  <th>Data</th>
                  {canAct && <th style={{ width: '10rem' }}>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const plan   = PLAN_META[row.requested_plan] ?? { label: row.requested_plan, color: 'var(--text-soft)' };
                  const status = STATUS_META[row.status as PlanRequestStatus];
                  return (
                    <tr key={row.id}>
                      {/* Membro */}
                      <td data-label="Membro">
                        <div className="adm-table-name">{row.user_name}</div>
                        <div className="adm-table-muted">{row.user_email}</div>
                      </td>

                      {/* Tipo */}
                      <td data-label="Tipo">
                        <span className="adm-badge adm-badge--neutral">
                          {row.type === 'onboarding' ? 'Novo cliente' : 'Troca de plano'}
                        </span>
                      </td>

                      {/* Plano */}
                      <td data-label="Plano">
                        <span
                          className="adm-badge"
                          style={{ color: plan.color, borderColor: `${plan.color}30` }}
                        >
                          {plan.label}
                        </span>
                      </td>

                      {/* Aporte */}
                      <td data-label="Aporte / mês">
                        <span className="adm-table-value">
                          {fmtCents(row.monthly_investment_cents)}
                        </span>
                      </td>

                      {/* KYC info */}
                      <td data-label="KYC">
                        {row.type === 'onboarding' ? (
                          <button
                            type="button"
                            onClick={() => setKycDetail(row)}
                            className="adm-btn adm-btn--ghost adm-btn--sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem' }}
                          >
                            <Eye size={12} strokeWidth={2} />
                            Ver KYC
                          </button>
                        ) : (
                          <span className="adm-table-muted">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td data-label="Status">
                        <span className={status.badge} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          {status.icon}
                          {status.label}
                        </span>
                        {row.review_note && (
                          <div className="adm-table-muted" style={{ marginTop: '0.25rem', fontSize: '0.7rem', maxWidth: 180 }}>
                            💬 {row.review_note}
                          </div>
                        )}
                      </td>

                      {/* Data */}
                      <td data-label="Data" className="adm-table-muted">
                        {new Date(row.created_at).toLocaleDateString('pt-BR')}
                      </td>

                      {/* Ações */}
                      {canAct && (
                        <td data-label="Ações">
                          {row.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleApprove(row.id)}
                                disabled={approving}
                                className="adm-btn adm-btn--success adm-btn--sm"
                              >
                                ✓ Aprovar
                              </button>
                              <button
                                onClick={() => setRejectTarget(row.id)}
                                className="adm-btn adm-btn--danger adm-btn--sm"
                              >
                                ✕ Rejeitar
                              </button>
                            </div>
                          ) : (
                            <span className="adm-table-muted">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > rows.length && (
          <p className="adm-table-meta">
            Mostrando {rows.length} de {total} solicitações.
          </p>
        )}
      </div>
    </>
  );
}
