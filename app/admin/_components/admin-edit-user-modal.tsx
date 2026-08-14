'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateUserPlanAction,
  toggleUserActiveAction,
  updateCareerAction,
  updateAdhesionPaidAction,
  updateMonthlyStatusAction,
} from '@/app/admin/admin.actions';

const PLANS = [
  { value: 'sem_plano', label: 'Sem Plano' },
  { value: 'start',     label: 'Start'     },
  { value: 'prime',     label: 'Prime'     },
  { value: 'elite',     label: 'Elite'     },
];

const CAREERS = [
  { value: '',               label: 'Sem definição (automático)' },
  { value: 'vendedor_elite', label: 'Afiliado Prime — N1'        },
  { value: 'supervisor',     label: 'Advisor — N1 + N2'          },
  { value: 'gestor',         label: 'Gestor — N1 + N2 + N3'      },
  { value: 'gerente_senior', label: 'Gerente Sênior — N1 a N4'   },
  { value: 'diretor_geral',  label: 'Diretor Geral — N1 a N5'    },
];

type User = {
  id: string;
  name: string;
  plan_interest: string | null;
  cashback_pct: number | null;
  adhesion_value_cents: number | null;
  plan_monthly_cents: number | null;
  is_active: boolean | null;
  career: string | null;
  adhesion_paid: boolean | null;
  monthly_status: 'paid' | 'overdue' | null;
};

/** Valores-padrão por plano (name → { monthlyCents, adhesionCents }) */
export type PlanDefaults = Record<string, { monthlyCents: number; adhesionCents: number }>;

type Props = { user: User; onClose: () => void; planDefaults?: PlanDefaults };

function centsToBrl(cents: number | null): string {
  if (cents == null) return '';
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function maskBrl(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AdminEditUserModal({ user, onClose, planDefaults = {} }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [state,         action,          pending]          = useActionState(updateUserPlanAction,     null);
  const [toggleState,   toggleAction,    togglePending]    = useActionState(toggleUserActiveAction,   null);
  const [careerState,   careerAction,    careerPending]    = useActionState(updateCareerAction,       null);
  const [adhesionState, adhesionAction,  adhesionPending]  = useActionState(updateAdhesionPaidAction, null);
  const [monthlyState,  monthlyAction,   monthlyPending]   = useActionState(updateMonthlyStatusAction,null);

  const isActive = user.is_active !== false;
  // Usuário tem adesão contratada quando tem adhesion_value_cents
  const hasAdhesion = (user.adhesion_value_cents ?? 0) > 0;

  const [monthlyVal,  setMonthlyVal]  = useState(() => centsToBrl(user.plan_monthly_cents));
  const [adhesionVal, setAdhesionVal] = useState(() => centsToBrl(user.adhesion_value_cents));

  function handleMoney(
    setter: React.Dispatch<React.SetStateAction<string>>
  ): React.ChangeEventHandler<HTMLInputElement> {
    return (e) => setter(maskBrl(e.target.value));
  }

  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => { if (state?.ok) { router.refresh(); const t = setTimeout(onClose, 1500); return () => clearTimeout(t); } }, [state, onClose, router]);
  useEffect(() => { if (toggleState?.ok) { router.refresh(); const t = setTimeout(onClose, 1500); return () => clearTimeout(t); } }, [toggleState, onClose, router]);
  useEffect(() => { if (careerState?.ok) router.refresh(); }, [careerState, router]);
  useEffect(() => { if (adhesionState?.ok) router.refresh(); }, [adhesionState, router]);
  useEffect(() => { if (monthlyState?.ok) router.refresh(); }, [monthlyState, router]);

  function handleBackdrop(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === ref.current) onClose();
  }

  return (
    <dialog ref={ref} className="eum-dialog" onClick={handleBackdrop}>
      <div className="eum-wrap">

        {/* ── HEADER ─────────────────────────────────────── */}
        <header className="eum-header">
          <div className="eum-header-left">
            <span className="eum-eyebrow">Painel · Usuário</span>
            <h2 className="eum-title">{user.name}</h2>
          </div>
          <div className="eum-header-right">
            <span className={`eum-status-pill ${isActive ? 'eum-status-pill--on' : 'eum-status-pill--off'}`}>
              <span className="eum-status-dot" />
              {isActive ? 'Ativo' : 'Desativado'}
            </span>
            <button type="button" className="eum-close" onClick={onClose} aria-label="Fechar">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </header>

        {/* ── SECTION: PLANO ─────────────────────────────── */}
        <form action={action} className="eum-body">
          <input type="hidden" name="userId" value={user.id} />

          <p className="eum-section-label">
            <span className="eum-section-line" />
            Configurações do plano
          </p>

          <div className="eum-grid">
            <div className="eum-field eum-field--full">
              <label className="eum-label" htmlFor={`plan-${user.id}`}>Plano</label>
              <div className="eum-select-wrap">
                <select id={`plan-${user.id}`} name="plan" className="eum-select"
                  defaultValue={user.plan_interest ?? 'sem_plano'}>
                  {PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <svg className="eum-select-icon" viewBox="0 0 16 16" fill="none">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            <div className="eum-field">
              <label className="eum-label" htmlFor={`cb-${user.id}`}>
                Cashback <span className="eum-unit">%</span>
              </label>
              <input id={`cb-${user.id}`} name="cashbackPct" type="number" min={0} max={100} step={1}
                className="eum-input" defaultValue={user.cashback_pct ?? 40} placeholder="40" />
            </div>

            <div className="eum-field">
              <label className="eum-label" htmlFor={`inv-${user.id}`}>
                Crédito Contratado <span className="eum-unit">R$</span>
              </label>
              <input id={`inv-${user.id}`} name="adhesionValue" type="text" inputMode="numeric"
                className="eum-input" value={adhesionVal} onChange={handleMoney(setAdhesionVal)} placeholder="0,00" />
            </div>

            <div className="eum-field">
              <label className="eum-label" htmlFor={`mo-${user.id}`}>
                Mensalidade <span className="eum-unit">R$</span>
              </label>
              <input id={`mo-${user.id}`} name="monthlyValue" type="text" inputMode="numeric"
                className="eum-input" value={monthlyVal} onChange={handleMoney(setMonthlyVal)} placeholder="0,00" />
            </div>
          </div>

          {state && (
            <p className={`eum-feedback ${state.ok ? 'eum-feedback--ok' : 'eum-feedback--err'}`}>
              {state.message}
            </p>
          )}

          <div className="eum-actions">
            <button type="button" className="eum-btn eum-btn--ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </button>
            <button type="submit" className="eum-btn eum-btn--primary" disabled={pending}>
              {pending ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </form>

        {/* ── SECTION: CARREIRA ───────────────────────────── */}
        <form action={careerAction} className="eum-body" style={{ paddingTop: 0 }}>
          <input type="hidden" name="userId" value={user.id} />

          <p className="eum-section-label">
            <span className="eum-section-line" />
            Carreira &amp; Comissão de rede
          </p>

          <div className="eum-field eum-field--full">
            <label className="eum-label" htmlFor={`career-${user.id}`}>Nível de carreira</label>
            <div className="eum-select-wrap">
              <select id={`career-${user.id}`} name="career" className="eum-select"
                defaultValue={user.career ?? ''}>
                {CAREERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <svg className="eum-select-icon" viewBox="0 0 16 16" fill="none">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-soft)', marginTop: '0.35rem' }}>
              &quot;Sem definição&quot; usa o cálculo automático por atividade da rede.
            </p>
          </div>

          {careerState && (
            <p className={`eum-feedback ${careerState.ok ? 'eum-feedback--ok' : 'eum-feedback--err'}`}>
              {careerState.message}
            </p>
          )}

          <div className="eum-actions" style={{ paddingTop: 0 }}>
            <button type="submit" className="eum-btn eum-btn--primary" disabled={careerPending}>
              {careerPending ? 'Salvando…' : 'Salvar carreira'}
            </button>
          </div>
        </form>

        {/* ── SECTION: STATUS DE PAGAMENTO ───────────────── */}
        <div className="eum-body" style={{ paddingTop: 0 }}>
          <p className="eum-section-label">
            <span className="eum-section-line" />
            Status de pagamento
          </p>

          {/* Adesão Paga */}
          <form action={adhesionAction} style={{ marginBottom: '0.75rem' }}>
            <input type="hidden" name="userId" value={user.id} />
            <div className="eum-field eum-field--full">
              <label className="eum-label">Adesão paga</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {(['true', 'false'] as const).map((v) => {
                  const isSim = v === 'true';
                  const active = isSim
                    ? (user.adhesion_paid === true)
                    : (user.adhesion_paid !== true);
                  return (
                    <button
                      key={v}
                      type="submit"
                      name="adhesion_paid"
                      value={v}
                      disabled={adhesionPending}
                      className={`eum-btn eum-btn--sm ${active
                        ? isSim ? 'eum-btn--success' : 'eum-btn--danger'
                        : 'eum-btn--ghost'
                      }`}
                      style={active ? undefined : { opacity: 0.55 }}
                    >
                      {isSim ? '✓ Sim' : '✗ Não'}
                    </button>
                  );
                })}
              </div>
            </div>
            {adhesionState && (
              <p className={`eum-feedback ${adhesionState.ok ? 'eum-feedback--ok' : 'eum-feedback--err'}`}
                style={{ marginTop: '0.4rem' }}>
                {adhesionState.message}
              </p>
            )}
          </form>

          {/* Mensalidade — só aparece quando há adesão contratada */}
          {hasAdhesion && (
            <form action={monthlyAction}>
              <input type="hidden" name="userId" value={user.id} />
              <div className="eum-field eum-field--full">
                <label className="eum-label">Status da mensalidade</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {([
                    { value: 'paid',    label: '✓ Paga',    cls: 'eum-btn--success' },
                    { value: 'overdue', label: '⚠ Atrasado', cls: 'eum-btn--danger'  },
                  ] as const).map(({ value, label, cls }) => {
                    const active = user.monthly_status === value;
                    return (
                      <button
                        key={value}
                        type="submit"
                        name="monthly_status"
                        value={value}
                        disabled={monthlyPending}
                        className={`eum-btn eum-btn--sm ${active ? cls : 'eum-btn--ghost'}`}
                        style={active ? undefined : { opacity: 0.55 }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {monthlyState && (
                <p className={`eum-feedback ${monthlyState.ok ? 'eum-feedback--ok' : 'eum-feedback--err'}`}
                  style={{ marginTop: '0.4rem' }}>
                  {monthlyState.message}
                </p>
              )}
            </form>
          )}
        </div>

        {/* ── SECTION: ACESSO ────────────────────────────── */}
        <div className={`eum-access-block ${isActive ? '' : 'eum-access-block--off'}`}>
          <div className="eum-access-info">
            <p className="eum-access-title">Controle de acesso</p>
            <p className="eum-access-desc">
              {isActive
                ? 'Usuário com acesso normal.'
                : 'Acesso suspenso — usuário não consegue fazer login.'}
            </p>
          </div>
          <form action={toggleAction}>
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="active" value={isActive ? 'false' : 'true'} />
            <button type="submit" disabled={togglePending}
              className={`eum-btn eum-btn--sm ${isActive ? 'eum-btn--danger' : 'eum-btn--success'}`}>
              {togglePending ? 'Aguarde…' : isActive ? 'Desativar acesso' : 'Reativar acesso'}
            </button>
          </form>
          {toggleState && (
            <p className={`eum-feedback ${toggleState.ok ? 'eum-feedback--ok' : 'eum-feedback--err'}`}
              style={{ marginTop: '0.6rem', gridColumn: '1/-1' }}>
              {toggleState.message}
            </p>
          )}
        </div>

      </div>
    </dialog>
  );
}
