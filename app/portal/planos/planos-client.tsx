'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import type { User } from '@/src/features/auth';
import type { PlanRequestRow } from '@/src/features/plans/plan-requests.repository';
import { submitPlanChangeAction } from './plans.actions';
import KycModal from './kyc-modal';

// ── Definição dos planos ───────────────────────────────────────────────────────

type PlanTier = 'start' | 'prime' | 'elite';

type PlanDef = {
  id: PlanTier;
  name: string;
  kicker: string;
  range: string;
  hex: string;
  rgb: string;
  features: string[];
  popular?: boolean;
};

const PLANS: PlanDef[] = [
  {
    id: 'start',
    name: 'Start',
    kicker: 'Primeiro passo',
    range: 'R$ 520 – R$ 1.039 / mês',
    hex: '#60a5fa',
    rgb: '96,165,250',
    features: [
      'Acesso completo ao portal',
      'Programa de indicação',
      'Cashback de até 50% ao mês',
      'Suporte padrão',
    ],
  },
  {
    id: 'prime',
    name: 'Prime',
    kicker: 'Mais escolhido',
    range: 'R$ 1.040 – R$ 9.999 / mês',
    hex: '#38bdf8',
    rgb: '56,189,248',
    features: [
      'Tudo do plano Start',
      'Cashback ampliado',
      'Comissões de rede até nível 5',
      'Gestor dedicado',
      'Atendimento prioritário',
    ],
    popular: true,
  },
  {
    id: 'elite',
    name: 'Elite',
    kicker: 'Acesso máximo',
    range: 'A partir de R$ 10.000 / mês',
    hex: '#a78bfa',
    rgb: '167,139,250',
    features: [
      'Tudo do plano Prime',
      'Cashback máximo garantido',
      'Gerente de conta exclusivo',
      'Eventos e treinamentos VIP',
    ],
  },
];

// ── Componente principal ──────────────────────────────────────────────────────

type Props = {
  user: User;
  kycSubmitted: boolean;
  pendingRequest: PlanRequestRow | null;
};

export default function PlanosClient({ user, kycSubmitted, pendingRequest }: Props) {
  const currentPlan = (user.planInterest ?? null) as PlanTier | null;
  const hasActivePlan = currentPlan !== null;

  // Estado do KYC modal — qual plano foi pré-selecionado ao clicar
  const [kycOpen, setKycOpen] = useState(!kycSubmitted && !hasActivePlan);

  // Estado do form de alteração de plano (apenas para quem já tem plano)
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [selectedChange, setSelectedChange] = useState<PlanTier>(
    PLANS.find(p => p.id !== currentPlan)?.id ?? 'prime'
  );
  const [aporte, setAporte]     = useState('');
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [isPending, startTransition] = useTransition();

  // Plano pré-selecionado para abrir o KYC (sem plano ativo)
  const [kycPrePlan, setKycPrePlan] = useState<PlanTier>('prime');

  function openKycFor(planId: PlanTier) {
    setKycPrePlan(planId);
    setKycOpen(true);
  }

  function handleChangePlan(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    const fd = new FormData();
    fd.set('requested_plan', selectedChange);
    fd.set('monthly_investment', aporte);
    startTransition(async () => {
      const res = await submitPlanChangeAction(fd);
      if (res.error) setError(res.error);
      else {
        setSuccess('Solicitação enviada! O time financeiro irá analisar em breve.');
        setChangePlanOpen(false);
      }
    });
  }

  const changeActivePlan = PLANS.find(p => p.id === selectedChange)!;
  const accentLine = `linear-gradient(90deg, transparent, ${changeActivePlan.hex}, rgba(${changeActivePlan.rgb},0.3), transparent)`;

  return (
    <>
      {/* KYC Modal — novos usuários sem plano ativo */}
      {kycOpen && (
        <KycModal
          onClose={() => setKycOpen(false)}
          userEmail={user.email}
          mandatory={!kycSubmitted}
        />
      )}

      {/* ══ Tela de Espera Premium (Taste Skill / Construtor) ══ */}
      {kycSubmitted && !hasActivePlan && !kycOpen && (
        <PremiumWaitingScreen pendingRequest={pendingRequest} />
      )}

      {/* ══ Conteúdo normal dos planos — só quando NÃO está na tela de espera ══ */}
      {!(kycSubmitted && !hasActivePlan && !kycOpen) && (
      <div className="portal-page">

        {/* ══ Cabeçalho ══ */}
        <header style={{ marginBottom: '2rem' }}>
          <span className="pln-kicker">Estratégia Patrimonial</span>
          <h1 className="pln-title">Planos de Investimento</h1>
          <p className="pln-subtitle">
            {hasActivePlan
              ? 'Você já possui um plano ativo. Confira os detalhes ou solicite uma alteração.'
              : 'Escolha o plano ideal para o seu perfil e comece a construir sua rota patrimonial.'}
          </p>
        </header>

        {/* ══ Banner: solicitação pendente ══ */}
        {pendingRequest && (
          <div className="pln-banner">
            <span className="pln-banner-icon">⏳</span>
            <div>
              <p className="pln-banner-title">Solicitação em análise</p>
              <p className="pln-banner-body">
                Sua solicitação para o plano{' '}
                <strong style={{ color: '#f0f8ff' }}>
                  {pendingRequest.requested_plan.toUpperCase()}
                </strong>{' '}
                está sendo revisada pelo time financeiro.
              </p>
            </div>
          </div>
        )}

        {/* ══ Cards dos planos ══ */}
        <div className="pln-grid">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;

            // ── SEM PLANO ATIVO: cards são botões que abrem o KYC ──
            if (!hasActivePlan) {
              return (
                <button
                  key={plan.id}
                  type="button"
                  className="pln-card"
                  data-selected={plan.id === kycPrePlan}
                  onClick={() => openKycFor(plan.id)}
                  style={{
                    borderColor: plan.id === kycPrePlan ? plan.hex : 'rgba(255,255,255,0.06)',
                    background: plan.id === kycPrePlan
                      ? `linear-gradient(180deg, rgba(${plan.rgb},0.09) 0%, rgba(${plan.rgb},0.04) 100%)`
                      : 'rgba(255,255,255,0.02)',
                    boxShadow: plan.id === kycPrePlan
                      ? `0 0 32px -8px rgba(${plan.rgb},0.22), 0 8px 32px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(${plan.rgb},0.1)`
                      : '0 2px 16px -4px rgba(0,0,0,0.35)',
                    cursor: 'pointer',
                  }}
                  aria-label={`Selecionar plano ${plan.name}`}
                >
                  <CardInner plan={plan} isCurrent={false} isSelected={plan.id === kycPrePlan} />

                  {/* CTA inline no card */}
                  <div style={{
                    marginTop: 'auto',
                    paddingTop: '1rem',
                    borderTop: `1px solid rgba(${plan.rgb},0.12)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    color: plan.hex,
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                  }}>
                    Escolher este plano →
                  </div>
                </button>
              );
            }

            // ── COM PLANO ATIVO: cards são informativos (não clicáveis) ──
            return (
              <div
                key={plan.id}
                className="pln-card"
                data-selected={isCurrent}
                style={{
                  borderColor: isCurrent ? plan.hex : 'rgba(255,255,255,0.06)',
                  background: isCurrent
                    ? `linear-gradient(180deg, rgba(${plan.rgb},0.09) 0%, rgba(${plan.rgb},0.04) 100%)`
                    : 'rgba(255,255,255,0.02)',
                  boxShadow: isCurrent
                    ? `0 0 32px -8px rgba(${plan.rgb},0.22), 0 8px 32px -8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(${plan.rgb},0.1)`
                    : '0 2px 16px -4px rgba(0,0,0,0.35)',
                  cursor: 'default',
                  pointerEvents: 'none',
                }}
              >
                <CardInner plan={plan} isCurrent={isCurrent} isSelected={isCurrent} />
              </div>
            );
          })}
        </div>

        {/* ══ Card: Alterar plano — apenas com plano ativo ══ */}
        {hasActivePlan && !pendingRequest && (
          <div className="pln-form-box" style={{ marginTop: '2rem' }}>
            <span
              aria-hidden
              className="pln-form-accent-line"
              style={{ background: accentLine }}
            />

            {!changePlanOpen ? (
              /* Botão gatilho */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                <h2 className="pln-form-title">Alterar plano</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Plano atual:{' '}
                  <strong style={{ color: PLANS.find(p => p.id === currentPlan)?.hex }}>
                    {PLANS.find(p => p.id === currentPlan)?.name}
                  </strong>
                </p>
                <button
                  type="button"
                  className="pln-submit"
                  onClick={() => setChangePlanOpen(true)}
                  style={{ width: 'auto', padding: '0.7rem 1.75rem' }}
                >
                  Solicitar alteração
                </button>
              </div>
            ) : (
              /* Formulário de alteração */
              <form onSubmit={handleChangePlan}>
                <h2 className="pln-form-title" style={{ marginBottom: '1.25rem' }}>
                  Solicitar alteração de plano
                </h2>

                {/* Seleção do novo plano */}
                <div className="pln-field">
                  <label className="pln-label">Novo plano</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {PLANS.filter(p => p.id !== currentPlan).map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedChange(p.id)}
                        style={{
                          padding: '0.5rem 1.1rem',
                          borderRadius: '0.6rem',
                          border: `1px solid ${selectedChange === p.id ? p.hex : 'rgba(255,255,255,0.1)'}`,
                          background: selectedChange === p.id ? `rgba(${p.rgb},0.12)` : 'transparent',
                          color: selectedChange === p.id ? p.hex : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          transition: 'all 0.2s',
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aporte mensal */}
                <div className="pln-field">
                  <label htmlFor="pln-chg-aporte" className="pln-label">
                    Aporte mensal pretendido (R$) *
                  </label>
                  <input
                    id="pln-chg-aporte"
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={aporte}
                    onChange={(e) => setAporte(e.target.value)}
                    placeholder="Ex: 3000"
                    className="pln-input"
                  />
                </div>

                {error   && <p className="pln-error">⚠️ {error}</p>}
                {success && <p className="pln-success">✓ {success}</p>}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => { setChangePlanOpen(false); setError(''); setSuccess(''); }}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '0.6rem',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || !aporte}
                    className="pln-submit"
                    style={{ flex: 2 }}
                  >
                    {isPending ? 'Enviando...' : 'Enviar para análise'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
      )}
    </>
  );
}

// ── Componente interno reutilizável — conteúdo visual do card ─────────────────

function CardInner({
  plan,
  isCurrent,
  isSelected,
}: {
  plan: PlanDef;
  isCurrent: boolean;
  isSelected: boolean;
}) {
  return (
    <>
      {/* Linha de accent no topo */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 0, left: '10%', right: '10%',
          height: isSelected ? '2px' : '1px',
          background: isSelected
            ? `linear-gradient(90deg, transparent, ${plan.hex}, rgba(${plan.rgb},0.4), transparent)`
            : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
          borderRadius: '1px',
          transition: 'all 0.22s',
        }}
      />

      {/* Badges */}
      <div className="pln-card-badges">
        {isCurrent && (
          <span className="pln-badge-current" style={{ background: plan.hex }}>
            Atual
          </span>
        )}
        {plan.popular && !isCurrent && (
          <span
            className="pln-badge-popular"
            style={{
              color: plan.hex,
              borderColor: `rgba(${plan.rgb},0.35)`,
              background: `rgba(${plan.rgb},0.1)`,
            }}
          >
            ★ Popular
          </span>
        )}
      </div>

      {/* Kicker */}
      <span
        className="pln-card-kicker"
        style={{ color: isSelected ? plan.hex : undefined }}
      >
        {plan.kicker}
      </span>

      {/* Nome */}
      <div
        className="pln-card-name"
        style={{
          color: plan.hex,
          textShadow: isSelected ? `0 0 24px rgba(${plan.rgb},0.55)` : 'none',
        }}
      >
        {plan.name}
      </div>

      {/* Range */}
      <div className="pln-card-range">{plan.range}</div>

      {/* Divisória */}
      <hr
        className="pln-card-divider"
        style={{
          background: isSelected
            ? `linear-gradient(90deg, rgba(${plan.rgb},0.35), transparent)`
            : undefined,
        }}
      />

      {/* Features */}
      <ul className="pln-card-features">
        {plan.features.map((feat) => (
          <li key={feat} className="pln-feat">
            <span className="pln-feat-check" style={{ color: plan.hex }}>✓</span>
            {feat}
          </li>
        ))}
      </ul>
    </>
  );
}

// ── Tela de Espera Premium (Taste Skill / Construtor / Terminal Telemetry) ──
const TELEMETRY_LINES = [
  '[$SYS] Inicializando ambiente seguro...',
  '[$KYC] Acessando dossiê do cliente...',
  '[$KYC] Verificando integridade dos documentos [OK]',
  '[$RISK] Avaliando perfil de exposição e alocação [OK]',
  '[$FIN] Validando fluxo de aporte mensal...',
  '[$FIN] Encaminhando para mesa de aprovação...',
  '[$FIN] Atribuindo analista financeiro...',
  '[$SYS] Status alterado para: AWAITING_MANUAL_REVIEW',
  '[$SYS] Suspendendo processos automáticos. Aguardando intervenção humana.',
];

function PremiumWaitingScreen({ pendingRequest }: { pendingRequest: PlanRequestRow | null }) {
  const [telemetry, setTelemetry] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [typedChars, setTypedChars] = useState('');
  
  // Telemetry Typewriter Engine
  useEffect(() => {
    if (currentLineIndex >= TELEMETRY_LINES.length) return;

    const fullLine = TELEMETRY_LINES[currentLineIndex];
    
    if (typedChars.length < fullLine.length) {
      const timeout = setTimeout(() => {
        setTypedChars(fullLine.slice(0, typedChars.length + 1));
      }, Math.random() * 30 + 15); // Velocidade de digitação variável
      return () => clearTimeout(timeout);
    } else {
      const waitTimeout = setTimeout(() => {
        setTelemetry(prev => [...prev, fullLine]);
        setCurrentLineIndex(prev => prev + 1);
        setTypedChars('');
      }, Math.random() * 800 + 400); // Pausa entre linhas
      return () => clearTimeout(waitTimeout);
    }
  }, [currentLineIndex, typedChars]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [telemetry, typedChars]);

  return (
    <div style={{
      minHeight: '75vh',
      width: '100%',
      // Integrando com o fundo global ou forçando dark blue
      background: 'rgba(7, 20, 31, 0.4)', 
      color: 'var(--text, #f3f9fd)',
      fontFamily: "var(--font-sans), 'Inter', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      borderRadius: 'var(--radius-xl, 1.5rem)',
      border: '1px solid var(--surface-border)',
      overflow: 'hidden',
      marginTop: '2rem',
    }}>
      {/* Dynamic Background Grain/Texture (Subtle) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Background Accent Glow usando cor sky/accent da marca */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '30%',
        transform: 'translate(-50%, -50%)',
        width: '60vw',
        height: '60vw',
        background: 'radial-gradient(circle, rgba(56, 189, 248, 0.04) 0%, rgba(3, 11, 19, 0) 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '3rem',
        width: '100%',
        padding: '3rem 2rem',
        position: 'relative',
        zIndex: 1,
        alignItems: 'center',
      }}>
        
        {/* Left Column: Dramatic Typography & Core Message */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 999,
            padding: '0.4rem 1.2rem',
            alignSelf: 'flex-start',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent, #38bdf8)',
            background: 'rgba(56, 189, 248, 0.05)',
            backdropFilter: 'blur(8px)',
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent, #38bdf8)',
              animation: 'pulsateDot 1.5s ease-in-out infinite',
            }} />
            Em análise
          </div>

          <h1 style={{
            fontSize: 'clamp(2rem, 4vw, 3.5rem)',
            lineHeight: 1.1,
            margin: 0,
            fontWeight: 300,
            letterSpacing: '-0.02em',
          }}>
            Sua jornada <br />
            <span style={{ 
              fontFamily: "var(--font-display), 'Playfair Display', 'Georgia', serif",
              fontStyle: 'italic',
              fontWeight: 600,
              background: 'var(--brand-gradient, linear-gradient(135deg, #dff5ff 0%, #7dd3fc 28%, #38bdf8 65%, #0ea5e9 100%))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '0',
            }}>
              está em processamento
            </span>
          </h1>

          <p style={{
            fontSize: '1.05rem',
            color: 'var(--text-muted, rgba(216, 226, 236, 0.88))',
            lineHeight: 1.6,
            maxWidth: 480,
            marginTop: '0.5rem',
          }}>
            Recebemos seu dossiê com sucesso. Nossa mesa financeira está analisando sua solicitação para estruturar a estratégia adequada. 
            <br /><br />
            Em breve, nosso time de curadoria entrará em contato pelo seu <strong style={{ color: '#25D366', fontWeight: 600 }}>WhatsApp</strong>.
          </p>

          <hr style={{ 
            border: 'none', 
            borderTop: '1px solid var(--surface-border, rgba(103, 196, 243, 0.14))',
            margin: '1rem 0',
            width: '100%',
            maxWidth: 320,
          }} />

          {/* Minimalist Data Readout */}
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Protocolo</span>
              <span style={{ fontSize: '1rem', fontFamily: 'monospace', color: 'var(--text)' }}>AXP-{Math.floor(Date.now() / 1000).toString().slice(-6)}</span>
            </div>
            {pendingRequest && (
              <>
                <div>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Plano Solicitado</span>
                  <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text)', textTransform: 'capitalize' }}>{pendingRequest.requested_plan}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-soft)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recebido em</span>
                  <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text)' }}>
                    {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(pendingRequest.created_at))}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Telemetry Typewriter UI */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(10, 25, 38, 0.82), rgba(4, 14, 23, 0.72))',
          border: '1px solid var(--surface-border)',
          borderRadius: 'var(--radius-lg, 1rem)',
          padding: '1.5rem',
          height: 380,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          boxShadow: 'var(--shadow)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}>
          {/* Header of terminal */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid var(--surface-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(56, 189, 248, 0.4)' }} />
              <span style={{ fontSize: '0.65rem', color: 'var(--text-soft)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>System Telemetry</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent, #38bdf8)', animation: 'pulsateDot 1s infinite' }} />
              <span style={{ fontSize: '0.65rem', color: 'var(--accent, #38bdf8)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live Feed</span>
            </div>
          </div>

          {/* Terminal Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            fontSize: '0.75rem',
            lineHeight: 1.6,
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            scrollbarWidth: 'none', // Firefox
          }}>
            {telemetry.map((line, i) => (
              <div key={i} style={{ 
                color: line.includes('[OK]') ? '#7dd3fc' : 
                       line.includes('AWAITING') ? '#38bdf8' : 'rgba(216, 226, 236, 0.6)' 
              }}>
                {line}
              </div>
            ))}
            
            {currentLineIndex < TELEMETRY_LINES.length && (
              <div style={{ color: 'var(--accent, #38bdf8)' }}>
                {typedChars}
                <span style={{ 
                  display: 'inline-block', 
                  width: 6, 
                  height: 12, 
                  background: 'var(--accent, #38bdf8)', 
                  verticalAlign: 'middle',
                  marginLeft: 4,
                  animation: 'blinkCursor 1s step-end infinite' 
                }} />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

      </div>

      <style>{`
        @keyframes pulsateDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.8); }
        }
        @keyframes blinkCursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        ::-webkit-scrollbar {
          width: 0px;
          background: transparent;
        }
      `}</style>
    </div>
  );
}

