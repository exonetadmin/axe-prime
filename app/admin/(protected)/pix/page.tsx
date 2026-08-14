import AdminModuleGate from '@/app/admin/_components/admin-module-gate';
import { adminRepository } from '@/src/features/admin/admin.repository';
import WithdrawalActions from '../saques/_withdrawal-actions';
import { Zap, CheckCircle2, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

function fmt(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

const WITHDRAWAL_FEE = 0.06;

export default async function PixPage() {
  return (
    <AdminModuleGate module="pix" title="Aprovação PIX">
      <PixContent />
    </AdminModuleGate>
  );
}

async function PixContent() {
  const { rows, total } = await adminRepository.listWithdrawals('pending', 100, 0);
  const totalValue = rows.reduce((s, r) => s + r.amount_cents, 0);
  const totalLiquido = Math.round(totalValue * (1 - WITHDRAWAL_FEE));

  return (
    <div className="adm-page">

      {/* ── Header ── */}
      <header className="adm-page-header">
        <div>
          <p className="adm-page-kicker">Financeiro · Operações PIX</p>
          <h1 className="adm-page-title">Aprovação PIX</h1>
          <p className="adm-page-sub">
            {total > 0 ? (
              <>
                <AlertCircle size={12} strokeWidth={2} style={{ verticalAlign: 'middle', color: '#fbbf24', marginRight: '3px' }} />
                <strong style={{ color: '#fbbf24' }}>{total}</strong> saque{total > 1 ? 's' : ''} aguardando
                {' · '}líquido a pagar: <strong style={{ color: 'var(--text)' }}>{fmt(totalLiquido)}</strong>
                <span style={{ color: 'var(--text-soft)', fontSize: '0.78rem' }}>{' '}(bruto: {fmt(totalValue)})</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={12} strokeWidth={2} style={{ verticalAlign: 'middle', color: 'var(--success)', marginRight: '3px' }} />
                Nenhum saque pendente — tudo processado
              </>
            )}
          </p>
        </div>
        <span className="adm-role-badge" style={{
          background: total > 0 ? 'rgba(251,191,36,0.08)' : 'rgba(52,211,153,0.08)',
          borderColor: total > 0 ? 'rgba(251,191,36,0.2)' : 'rgba(52,211,153,0.2)',
          color: total > 0 ? '#fbbf24' : 'var(--success)',
        }}>
          <Zap size={12} strokeWidth={2} />
          {fmt(totalLiquido)} líquido
        </span>
      </header>

      {total === 0 ? (
        <div className="adm-coming-soon">
          <CheckCircle2 size={36} strokeWidth={1.2} style={{ color: 'var(--success)', opacity: 0.7 }} />
          <p className="adm-coming-soon-title">Fila limpa 🎉</p>
          <p className="adm-coming-soon-sub">
            Todos os saques foram processados. Não há operações PIX pendentes.
          </p>
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Membro</th>
                <th>Valor a Pagar</th>
                <th>Chave PIX</th>
                <th>Tipo</th>
                <th>Solicitado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id}>
                  <td data-label="Membro">
                    <div className="adm-table-name">{w.user_name}</div>
                    <div className="adm-table-muted">{w.user_email}</div>
                  </td>
                  <td data-label="Valor a Pagar" className="adm-table-value">
                    <div>{fmt(Math.round(w.amount_cents * (1 - WITHDRAWAL_FEE)))}</div>
                    <div className="adm-table-muted" style={{ fontSize: '0.65rem' }}>Solicitado: {fmt(w.amount_cents)}</div>
                  </td>
                  <td data-label="Chave PIX">
                    <code className="adm-code">{w.pix_key}</code>
                  </td>
                  <td data-label="Tipo" className="adm-table-muted" style={{ textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.06em' }}>
                    {w.pix_key_type}
                  </td>
                  <td data-label="Solicitado em" className="adm-table-muted">
                    {new Date(w.requested_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td data-label="Ações">
                    <WithdrawalActions id={w.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="adm-table-meta">{total} operações pendentes · aprovação manual obrigatória</p>
    </div>
  );
}
