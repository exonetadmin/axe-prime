/**
 * HomeContractedCredit — Saldo premium estilo banco.
 * Refinamentos: ambient glow, traço vertical accent, métricas em linha.
 */

import type { FC } from 'react';

interface Props {
  adhesionValueCents: number | null;
  planName: string;
  planTier: string | null;
  /** Cashback previsto para o mês (em centavos), definido pelo admin. */
  cashbackMonthlyCents: number;
}

function formatBRLCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function splitBRL(cents: number): { integer: string; decimal: string } {
  const formatted = (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const [integer, decimal] = formatted.split(',');
  return { integer: integer!, decimal: decimal! };
}

const TIER_ACCENT: Record<string, string> = {
  start: '#60a5fa',
  prime: '#38bdf8',
  elite: '#a78bfa',
};

const HomeContractedCredit: FC<Props> = ({
  adhesionValueCents,
  planName,
  planTier,
  cashbackMonthlyCents,
}) => {
  const accent = TIER_ACCENT[planTier ?? 'prime'] ?? TIER_ACCENT.prime;
  const hasValue = adhesionValueCents != null && adhesionValueCents > 0;
  const hasCashback = cashbackMonthlyCents > 0;

  /* ── empty state ── */
  if (!hasValue) {
    return (
      <section style={{
        position: 'relative',
        padding: '0.75rem 1.25rem 0.5rem 1.5rem',
        borderLeft: `2px solid transparent`,
        borderImage: `linear-gradient(to bottom, transparent, ${accent}80, transparent) 1`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.85rem' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}80`, flexShrink: 0 }} />
          <span style={{ color: `${accent}b0`, fontSize: '0.62rem', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 500 }}>
            Crédito contratado · Plano {planName}
          </span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 'clamp(2rem, 7vw, 3rem)', fontWeight: 300, letterSpacing: '0.06em' }}>R$ —</span>
        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.73rem', marginTop: '0.4rem' }}>
          Crédito ainda não informado — aguarde seu consultor
        </p>
      </section>
    );
  }

  const { integer, decimal } = splitBRL(adhesionValueCents!);

  return (
    <section style={{
      position: 'relative',
      padding: '0.75rem 1.25rem 0.75rem 1.5rem',
      /* Traço vertical accent na esquerda */
      borderLeft: `2px solid transparent`,
      borderImage: `linear-gradient(to bottom, transparent 0%, ${accent} 40%, ${accent} 60%, transparent 100%) 1`,
      overflow: 'hidden',
    }}>

      {/* ── Ambient glow atrás do número ── */}
      <div aria-hidden="true" style={{
        position: 'absolute',
        top: '-20%',
        left: '-5%',
        width: '65%',
        height: '160%',
        background: `radial-gradient(ellipse at 30% 45%, ${accent}09 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      {/* ── Eyebrow ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.9rem', position: 'relative' }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: accent,
          boxShadow: `0 0 8px ${accent}80`,
          flexShrink: 0,
        }} />
        <span style={{
          color: `${accent}b0`,
          fontSize: '0.62rem',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          fontWeight: 500,
        }}>
          Crédito contratado · Plano {planName}
        </span>
      </div>

      {/* ── Valor principal ── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.4rem',
        lineHeight: 1,
        position: 'relative',
      }}>
        <span style={{
          color: 'rgba(255,255,255,0.32)',
          fontSize: '0.9rem',
          fontWeight: 400,
          paddingTop: '0.55rem',
          letterSpacing: '0.02em',
        }}>R$</span>
        <span style={{
          color: '#ffffff',
          fontSize: 'clamp(2.4rem, 8.5vw, 3.4rem)',
          fontWeight: 200,
          letterSpacing: '-0.03em',
        }}>{integer}</span>
        <span style={{
          color: 'rgba(255,255,255,0.38)',
          fontSize: 'clamp(1rem, 3vw, 1.35rem)',
          fontWeight: 300,
          paddingTop: '0.35rem',
        }}>,{decimal}</span>
      </div>

      {/* ── Subtítulo ── */}
      <p style={{
        color: 'rgba(255,255,255,0.22)',
        fontSize: '0.7rem',
        marginTop: '0.5rem',
        letterSpacing: '0.01em',
        position: 'relative',
      }}>
        Valor total alocado no seu plano patrimonial
      </p>

      {/* ── Separador gradiente ── */}
      <div style={{
        width: '100%',
        height: 1,
        background: `linear-gradient(90deg, ${accent}28 0%, ${accent}08 50%, transparent 100%)`,
        margin: '1rem 0 0.85rem',
        position: 'relative',
      }} />

      {/* ── Métricas em linha horizontal ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        position: 'relative',
        flexWrap: 'wrap',
      }}>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span style={{
            color: 'rgba(255,255,255,0.25)',
            fontSize: '0.6rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>Status</span>
          <span style={{ color: '#4ade80', fontSize: '0.82rem', fontWeight: 500 }}>Ativo</span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.2rem',
            padding: '0.12rem 0.42rem',
            borderRadius: 20,
            background: 'rgba(74,222,128,0.07)',
            border: '1px solid rgba(74,222,128,0.18)',
            color: '#4ade80',
            fontSize: '0.58rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}>● Rentabilizando</span>
        </div>

        {/* Bullet separador */}
        <span style={{
          color: 'rgba(255,255,255,0.12)',
          fontSize: '1rem',
          margin: '0 0.85rem',
          lineHeight: 1,
          userSelect: 'none',
        }}>·</span>

        {/* Cashback Mensal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <span style={{
            color: 'rgba(255,255,255,0.25)',
            fontSize: '0.6rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>Cashback mensal</span>
          {hasCashback ? (
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', fontWeight: 500 }}>
              {formatBRLCents(cashbackMonthlyCents)}
            </span>
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.82rem', fontWeight: 400 }}>
              A definir
            </span>
          )}
        </div>

      </div>
    </section>
  );
};

export default HomeContractedCredit;
