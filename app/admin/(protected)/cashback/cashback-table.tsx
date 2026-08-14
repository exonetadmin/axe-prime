'use client';

/**
 * CashbackTable — Tabela interativa com botão de popup por usuário.
 */

import { useState } from 'react';
import CashbackMonthsPopup, { type CashbackUserInfo } from './cashback-months-popup';
import { Banknote } from 'lucide-react';

export type CashbackRow = {
  id: string;
  name: string;
  email: string;
  plan_interest: string | null;
  plan_monthly_cents: number;
  adhesion_at: string;
  cashbackPct: number;
  cbMonthCents: number;
  mesesPagos: number;        // calculado no server
  mesesRestantes: number;
  totalPagoCents: number;
  paidMonths: number[];      // meses efetivamente confirmados no banco
};

function fmt(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

const PLAN_LABEL: Record<string, string> = {
  start: 'Start', prime: 'Prime', elite: 'Elite',
};

export default function CashbackTable({ rows }: { rows: CashbackRow[] }) {
  const [activeUser, setActiveUser] = useState<CashbackUserInfo | null>(null);

  return (
    <>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Membro</th>
              <th>Plano</th>
              <th>Mensalidade</th>
              <th>% CB</th>
              <th>CB/mês</th>
              <th>Pagos</th>
              <th>Restantes</th>
              <th>Total pago</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="adm-table-empty">
                  Nenhum participante com adesão ativa.
                </td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id}>
                  <td data-label="Membro">
                    <div className="adm-table-name">{u.name}</div>
                    <div className="adm-table-muted">{u.email}</div>
                  </td>
                  <td data-label="Plano">
                    <span className={`adm-badge adm-badge--${u.plan_interest ?? 'none'}`}>
                      {PLAN_LABEL[u.plan_interest ?? ''] ?? '—'}
                    </span>
                  </td>
                  <td data-label="Mensalidade" className="adm-table-muted">{fmt(u.plan_monthly_cents)}</td>
                  <td data-label="% CB">
                    <strong style={{ color: u.cashbackPct >= 50 ? 'var(--success)' : 'var(--accent)' }}>
                      {u.cashbackPct}%
                    </strong>
                  </td>
                  <td data-label="CB/mês">{fmt(u.cbMonthCents)}</td>
                  <td data-label="Pagos" style={{
                    color: u.paidMonths.length >= 12 ? 'var(--success)' : 'var(--text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {u.paidMonths.length}/12
                  </td>
                  <td data-label="Restantes" style={{
                    color: 12 - u.paidMonths.length > 0 ? '#fbbf24' : 'var(--text-soft)',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {12 - u.paidMonths.length}
                  </td>
                  <td data-label="Total pago" className="adm-table-value">
                    {fmt(u.paidMonths.length * u.cbMonthCents)}
                  </td>
                  <td data-label="Ação" style={{ textAlign: 'center' }}>
                    <button
                      className="adm-btn adm-btn--sm"
                      onClick={() => setActiveUser({
                        userId: u.id,
                        name: u.name,
                        email: u.email,
                        planLabel: PLAN_LABEL[u.plan_interest ?? ''] ?? '—',
                        monthlyCents: u.plan_monthly_cents,
                        cashbackPct: u.cashbackPct,
                        cbMonthCents: u.cbMonthCents,
                        paidMonths: u.paidMonths,
                      })}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        background: 'rgba(52,211,153,0.08)',
                        border: '1px solid rgba(52,211,153,0.2)',
                        color: '#34d399',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Banknote size={13} strokeWidth={1.8} />
                      Pagar CB
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Popup */}
      {activeUser && (
        <CashbackMonthsPopup
          user={activeUser}
          onClose={() => setActiveUser(null)}
        />
      )}
    </>
  );
}
