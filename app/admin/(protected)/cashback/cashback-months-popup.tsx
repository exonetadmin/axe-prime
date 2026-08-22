'use client';

/**
 * CashbackMonthsPopup — Popup para o admin marcar meses de cashback como pagos.
 * Mostra 12 meses com status (pago/pendente), botão para confirmar pagamento.
 */

import { useState, useTransition } from 'react';
import { markCashbackMonthAction, unmarkCashbackMonthAction } from '@/app/admin/admin.actions';
import { Check, X, Loader2, DollarSign, Calendar } from 'lucide-react';

export type CashbackUserInfo = {
  userId: string;
  name: string;
  email: string;
  planLabel: string;
  monthlyCents: number;
  cashbackPct: number;
  cbMonthCents: number;
  paidMonths: number[];  // [1, 2, 3] = meses 1-3 pagos
};

function fmt(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export default function CashbackMonthsPopup({
  user,
  onClose,
}: {
  user: CashbackUserInfo;
  onClose: () => void;
}) {
  const [paidSet, setPaidSet] = useState<Set<number>>(new Set(user.paidMonths));
  const [pending, startTransition] = useTransition();
  const [loadingMonth, setLoadingMonth] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const totalPaid = months.filter(m => paidSet.has(m)).length;
  const totalPaidCents = totalPaid * user.cbMonthCents;

  function handleToggle(month: number) {
    const isPaid = paidSet.has(month);
    setLoadingMonth(month);
    setFeedback(null);

    const fd = new FormData();
    fd.set('userId', user.userId);
    fd.set('monthNumber', String(month));

    startTransition(async () => {
      const action = isPaid ? unmarkCashbackMonthAction : markCashbackMonthAction;
      const result = await action(null, fd);

      if (result.ok) {
        setPaidSet(prev => {
          const next = new Set(prev);
          if (isPaid) {
            next.delete(month);
          } else {
            next.add(month);
          }
          return next;
        });
        setFeedback(result.message);
      } else {
        setFeedback(`❌ ${result.message}`);
      }
      setLoadingMonth(null);
    });
  }

  return (
    <div className="adm-modal-overlay" onClick={onClose}>
      <div
        className="adm-modal-card"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '520px', width: '96vw' }}
      >
        {/* Header */}
        <div className="adm-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <DollarSign size={16} strokeWidth={2} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
              Cashback Mensal
            </span>
          </div>
          <button className="adm-modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* User info */}
        <div style={{
          padding: '0.75rem 1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{user.name}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-soft)' }}>{user.email}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
              padding: '0.15rem 0.5rem', borderRadius: '999px',
              background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)',
              color: 'var(--accent)',
            }}>
              {user.planLabel}
            </span>
            <span style={{
              fontSize: '0.65rem', fontWeight: 700,
              padding: '0.15rem 0.5rem', borderRadius: '999px',
              background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
              color: 'var(--success)',
            }}>
              {user.cashbackPct}% CB
            </span>
          </div>
        </div>

        {/* KPIs rápidos */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: '0.75rem', padding: '1rem 1.25rem',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--success)' }}>{totalPaid}/12</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pagos</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)' }}>{fmt(user.cbMonthCents)}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>p/ mês</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{fmt(totalPaidCents)}</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total pago</div>
          </div>
        </div>

        {/* Grid de meses */}
        <div style={{
          padding: '1rem 1.25rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: '0.5rem',
          maxHeight: '380px',
          overflowY: 'auto',
        }}>
          {months.map(m => {
            const isPaid = paidSet.has(m);
            const isLoading = loadingMonth === m;

            return (
              <button
                key={m}
                disabled={pending && !isLoading}
                onClick={() => handleToggle(m)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid',
                  borderColor: isPaid
                    ? 'rgba(52,211,153,0.3)'
                    : 'rgba(255,255,255,0.08)',
                  background: isPaid
                    ? 'rgba(52,211,153,0.06)'
                    : 'rgba(255,255,255,0.02)',
                  cursor: pending && !isLoading ? 'not-allowed' : 'pointer',
                  opacity: pending && !isLoading ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                {/* Ícone de status */}
                <span style={{
                  width: '1.5rem', height: '1.5rem',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  background: isPaid
                    ? 'rgba(52,211,153,0.15)'
                    : 'rgba(255,255,255,0.05)',
                  border: '1px solid',
                  borderColor: isPaid ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)',
                  color: isPaid ? '#34d399' : 'var(--text-soft)',
                }}>
                  {isLoading
                    ? <Loader2 size={11} className="adm-spin" />
                    : isPaid
                      ? <Check size={11} strokeWidth={3} />
                      : <Calendar size={10} strokeWidth={1.5} />
                  }
                </span>

                {/* Texto */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: isPaid ? '#34d399' : 'var(--text)',
                  }}>
                    Mês {m}
                  </div>
                  <div style={{
                    fontSize: '0.62rem',
                    color: isPaid ? 'rgba(52,211,153,0.7)' : 'var(--text-soft)',
                  }}>
                    {isPaid ? 'Pago ✓' : 'Pendente'}
                  </div>
                </div>

                {/* Valor */}
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: isPaid ? '#34d399' : 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                }}>
                  {fmt(user.cbMonthCents)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {feedback && (
          <div style={{
            padding: '0.5rem 1.25rem',
            fontSize: '0.72rem',
            color: feedback.startsWith('❌') ? '#f87171' : '#34d399',
            textAlign: 'center',
          }}>
            {feedback}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button className="adm-btn adm-btn--ghost" onClick={onClose} style={{ fontSize: '0.75rem' }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
