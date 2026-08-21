'use client';

import { useState, useId, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import {
  ArrowDownToLine,
  X,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Coins,
  Info,
} from 'lucide-react';

/* ─── constants ─────────────────────────────────────── */

const WITHDRAWAL_FEE = 0.06;
const MIN_WITHDRAWAL = 100_00; // cents

/* ─── types ─────────────────────────────────────────── */

type TxStatus = 'Concluído' | 'Pendente' | 'Rejeitado';
type TxType = 'withdrawal' | 'commission_direct' | 'commission_network' | 'cashback';

interface Transaction {
  id: string;
  type: TxType;
  description: string;
  amountCents: number;
  direction: 'in' | 'out';
  status: TxStatus;
  date: string;
}

interface WalletClientProps {
  availableCents: number;
  cashbackCents: number;
  directSalesCents: number;
  networkCents: number;
  withdrawnCents: number;
  hasCpf: boolean;
  transactions: Transaction[];
}

/* ─── helpers ───────────────────────────────────────── */

function brl(cents: number, signed = false): string {
  const formatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
  return signed ? `+${formatted}` : formatted;
}

function feeCalc(requestedCents: number) {
  const fee = Math.round(requestedCents * WITHDRAWAL_FEE);
  const net = requestedCents - fee;
  return { fee, net };
}

/* ─── WithdrawalModal ────────────────────────────────── */

function WithdrawalModal({
  maxCents,
  onClose,
  onConfirm,
}: {
  maxCents: number;
  onClose: () => void;
  onConfirm: (amountCents: number) => Promise<void>;
}) {
  const sliderId = useId();
  const clampedMax = Math.max(maxCents, MIN_WITHDRAWAL);
  const [value, setValue] = useState(clampedMax); // Start at max available
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const { fee, net } = feeCalc(value);
  
  // Agora a porcentagem representa a barra total começando de 0.
  // Assim a posição visual sempre bate matematicamente com os botões.
  const pct = clampedMax === 0 ? 0 : (value / clampedMax) * 100;

  // Bloqueia scroll do body
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Fecha com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, sending]);

  const handleSubmit = async () => {
    setSending(true);
    setErrorMsg(null);
    try {
      await onConfirm(value);
      // Se der certo, onConfirm já fecha e refresh
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao processar saque.');
      setSending(false);
    }
  };

  const modal = (
    <div className="liqe-overlay" role="dialog" aria-modal="true" onClick={sending ? undefined : onClose}>
      <div className="liqe-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="liqe-header">
          <div className="liqe-title-group">
            <ArrowDownToLine size={20} strokeWidth={1.5} className="liqe-icon" />
            <h2 className="liqe-title">Extração de Liquidez</h2>
          </div>
          <button className="liqe-close-btn" onClick={onClose} aria-label="Fechar" disabled={sending}>
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* Amount & Quick Selects */}
        <div className="liqe-amount-group">
           <div className="liqe-amount-labels">
             <span className="liqe-amount-label">Montante (PIX)</span>
             <div className="liqe-quick-btns">
                 {[25, 50, 100].map(percentage => {
                   const stepValue = percentage === 100 ? clampedMax : Math.round(clampedMax * (percentage / 100));
                   // O botão calcula o valor, e grampeia com o limite mínimo
                   const finalValue = Math.max(MIN_WITHDRAWAL, stepValue);
                   const isActive = value === finalValue;
                   
                   return (
                     <button 
                       key={percentage}
                       onClick={() => setValue(finalValue)}
                       disabled={sending}
                       className="liqe-quick-btn"
                       style={isActive ? {
                         color: '#0a0f16',
                         backgroundColor: '#34d399',
                         borderColor: '#34d399'
                       } : {}}
                     >
                       {percentage}%
                     </button>
                   );
                 })}
             </div>
           </div>
           
           {/* Custom Premium Slider */}
           <div className="liqe-slider-container">
             <div className="liqe-slider-track">
               <div className="liqe-slider-fill" style={{ width: `${pct}%` }} />
             </div>
             <input
                id={sliderId}
                type="range"
                min={0}
                max={clampedMax}
                step={100}
                value={value}
                onChange={(e) => setValue(Math.max(MIN_WITHDRAWAL, Number(e.target.value)))}
                className="liqe-slider-input"
                disabled={sending}
             />
             <div className="liqe-slider-thumb" style={{ left: `calc(${pct}% - 8px)` }} />
           </div>
           <div className="liqe-slider-limits">
             <span>Mín: {brl(MIN_WITHDRAWAL)}</span>
             <span>Máx: {brl(clampedMax)}</span>
           </div>
        </div>

        {/* Telemetry Receipt */}
        <div className="liqe-receipt">
          <div className="liqe-receipt-row">
             <span className="liqe-receipt-label">Valor Solicitado</span>
             <span className="liqe-receipt-val">{brl(value)}</span>
          </div>
          <div className="liqe-receipt-row">
             <span className="liqe-receipt-label">Taxa de Saque (6%)</span>
             <span className="liqe-receipt-fee">− {brl(fee)}</span>
          </div>
          
          <div className="liqe-receipt-divider">
             <span className="liqe-receipt-net-label">Valor Líquido (VPL)</span>
             <span className="liqe-receipt-net-val">{brl(net)}</span>
          </div>
        </div>

        {/* Error */}
        {errorMsg && (
          <p className="liqe-error">{errorMsg}</p>
        )}

        {/* Confirm CTA */}
        <button
          className="liqe-cta"
          onClick={handleSubmit}
          disabled={sending}
        >
          <div className="liqe-cta-bg" />
          <span className="liqe-cta-content">
          {sending ? (
            <>
              <span className="liqe-spinner" aria-hidden />
              PROCESSANDO...
            </>
          ) : (
            <>
              <ArrowDownToLine size={16} strokeWidth={2.5} className="liqe-cta-icon" />
              EXECUTAR TRANSFERÊNCIA
            </>
          )}
          </span>
        </button>

        {/* Status System Note */}
        <div className="liqe-status">
          <span className="liqe-status-ping-wrap">
            <span className="liqe-status-ping"></span>
            <span className="liqe-status-dot"></span>
          </span>
          Conexão PIX Ativa · Liquidação D+1
        </div>

      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

/* ─── TransactionItem ────────────────────────────────── */

const typeIcon: Record<TxType, React.ReactNode> = {
  withdrawal: <ArrowDownToLine size={16} strokeWidth={1.8} />,
  commission_direct: <TrendingUp size={16} strokeWidth={1.8} />,
  commission_network: <Users size={16} strokeWidth={1.8} />,
  cashback: <Coins size={16} strokeWidth={1.8} />,
};

function TransactionItem({ tx }: { tx: Transaction }) {
  const isPending = tx.status === 'Pendente';
  const isRejected = tx.status === 'Rejeitado';
  const statusClass = isRejected ? 'is-rejected' : isPending ? 'is-pending' : 'is-done';

  return (
    <li className={`wlt-tx-item ${statusClass}`}>
      <div className={`wlt-tx-icon-wrap ${statusClass}`}>
        {typeIcon[tx.type]}
      </div>
      <div className="wlt-tx-body">
        <span className={`wlt-tx-desc${isRejected ? ' is-rejected' : ''}`}>{tx.description}</span>
        <span className="wlt-tx-date">{tx.date}</span>
      </div>
      <div className="wlt-tx-right">
        <span className={`wlt-tx-amount ${isRejected ? 'is-rejected' : tx.direction === 'out' ? 'is-out' : 'is-in'}`}>
          {tx.direction === 'out' ? '−' : '+'} {brl(tx.amountCents)}
        </span>
        <span className={`wlt-tx-badge ${statusClass}`}>
          {isRejected ? (
            <><X size={10} strokeWidth={2} /> Rejeitado</>
          ) : isPending ? (
            <><Clock size={10} strokeWidth={2} /> Pendente</>
          ) : (
            <><CheckCircle2 size={10} strokeWidth={2} /> Concluído</>
          )}
        </span>
      </div>
    </li>
  );
}

/* ─── Main WalletClient ──────────────────────────────── */

const TABS = ['Todos', 'Concluído', 'Pendente'] as const;
type Tab = typeof TABS[number];

export default function WalletClient({
  availableCents,
  cashbackCents,
  directSalesCents,
  networkCents,
  withdrawnCents,
  hasCpf,
  transactions,
}: WalletClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('Todos');
  const [localTxs, setLocalTxs] = useState<Transaction[]>(transactions);

  const filtered = activeTab === 'Todos'
    ? localTxs
    : localTxs.filter((t) => t.status === activeTab);

  const router = useRouter();

  const handleConfirm = useCallback(async (amountCents: number) => {
    const response = await apiFetch('/api/v1/withdrawals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountCents }),
    });
    const result = (await response.json()) as { ok?: boolean; message?: string };
    if (result.ok) {
      // Optimistic: insere a transação imediatamente na lista
      const now = new Date();
      const dateStr = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric',
      }).format(now);

      const optimisticTx: Transaction = {
        id: `wd-optimistic-${Date.now()}`,
        type: 'withdrawal',
        description: 'Saque PIX',
        amountCents,
        direction: 'out',
        status: 'Pendente',
        date: dateStr,
      };
      setLocalTxs((prev) => [optimisticTx, ...prev]);
      setModalOpen(false);
      router.refresh();
    } else {
      throw new Error(result.message ?? 'Não foi possível solicitar o saque.');
    }
  }, [router]);

  const canWithdraw = hasCpf && availableCents >= MIN_WITHDRAWAL;

  return (
    <div className="wlt-root">

      {/* ─── Hero Card ─────────────────────────────── */}
      <div className="wlt-hero">
        <div className="wlt-hero-glow" />

        <div className="wlt-hero-top">
          <div>
            <p className="wlt-hero-eyebrow">Saldo disponível</p>
            <p className="wlt-hero-balance">{brl(availableCents)}</p>
          </div>

          {hasCpf ? (
            <button
              className="wlt-pix-btn"
              onClick={() => setModalOpen(true)}
              disabled={!canWithdraw}
            >
              <ArrowDownToLine size={16} strokeWidth={2} />
              Solicitar Saque PIX
            </button>
          ) : (
            <div className="wlt-cpf-warning">
              <Info size={14} strokeWidth={2} />
              <span>
                Cadastre seu CPF no{' '}
                <a href="/portal/perfil" className="wlt-cpf-link">Perfil</a>{' '}
                para sacar.
              </span>
            </div>
          )}
        </div>

        {/* Ganhos por origem (total creditado/acumulado) */}
        <div className="wlt-origins">
          <div className="wlt-origin-item">
            <Coins size={13} strokeWidth={1.8} />
            <span className="wlt-origin-label">Cashback</span>
            <span className="wlt-origin-val">{brl(cashbackCents)}</span>
          </div>
          <span className="wlt-origin-sep" aria-hidden>·</span>
          <div className="wlt-origin-item">
            <TrendingUp size={13} strokeWidth={1.8} />
            <span className="wlt-origin-label">Venda Direta</span>
            <span className="wlt-origin-val">{brl(directSalesCents)}</span>
          </div>
          <span className="wlt-origin-sep" aria-hidden>·</span>
          <div className="wlt-origin-item">
            <Users size={13} strokeWidth={1.8} />
            <span className="wlt-origin-label">Comissão de Rede</span>
            <span className="wlt-origin-val">{brl(networkCents)}</span>
          </div>
        </div>

        {/* Já sacado — torna a conta transparente: ganhos − sacado = saldo disponível */}
        {withdrawnCents > 0 && (
          <div className="wlt-origins" style={{ marginTop: 8 }}>
            <div className="wlt-origin-item">
              <ArrowDownToLine size={13} strokeWidth={1.8} />
              <span className="wlt-origin-label">Já sacado</span>
              <span className="wlt-origin-val" style={{ color: 'var(--text-soft)' }}>
                − {brl(withdrawnCents)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Extrato ───────────────────────────────── */}
      <div className="wlt-extrato">

        {/* Tab bar */}
        <div className="wlt-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className={`wlt-tab${activeTab === tab ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Transaction list */}
        {filtered.length === 0 ? (
          <p className="wlt-empty">Nenhuma transação encontrada.</p>
        ) : (
          <ul className="wlt-tx-list">
            {filtered.map((tx) => (
              <TransactionItem key={tx.id} tx={tx} />
            ))}
          </ul>
        )}
      </div>

      {/* ─── Modal ─────────────────────────────────── */}
      {modalOpen && (
        <WithdrawalModal
          maxCents={availableCents}
          onClose={() => setModalOpen(false)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
