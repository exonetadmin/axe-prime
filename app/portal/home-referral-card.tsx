'use client';

import { useState, useCallback } from 'react';

type Props = {
  url: string;
  code: string;
};

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

export default function HomeReferralCard({ url, code }: Props) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const copy = useCallback(async (text: string, setter: (v: boolean) => void) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2500);
    } catch { /* blocked */ }
  }, []);

  if (!code && !url) return null;

  return (
    <article className="hrc-card">
      {/* Glow de fundo decorativo */}
      <div className="hrc-glow" aria-hidden />

      {/* Cabeçalho */}
      <header className="hrc-header">
        <div className="hrc-header-icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </div>
        <div className="hrc-header-text">
          <span className="hrc-eyebrow">Indicação</span>
          <span className="hrc-title">Seu link de indicação</span>
        </div>
        <span className="hrc-badge">Ativo</span>
      </header>

      {/* Divisor */}
      <div className="hrc-divider" />

      {/* Corpo: 2 colunas — link | código */}
      <div className="hrc-body">

        {/* Coluna: Link */}
        {url && (
          <div className="hrc-col hrc-col-link">
            <span className="hrc-col-label">Link de cadastro</span>
            <div className="hrc-field-wrap">
              <code className="hrc-field-value hrc-field-url">{url}</code>
              <button
                type="button"
                className={`hrc-btn${copiedLink ? ' hrc-btn--done' : ''}`}
                onClick={() => copy(url, setCopiedLink)}
                aria-label="Copiar link de indicação"
                aria-live="polite"
              >
                {copiedLink ? <CheckIcon /> : <CopyIcon />}
                {copiedLink ? 'Copiado!' : 'Copiar link'}
              </button>
            </div>
          </div>
        )}

        {/* Divisor vertical (apenas desktop) */}
        {url && code && <div className="hrc-vdivider" aria-hidden />}

        {/* Coluna: Código */}
        {code && (
          <div className="hrc-col hrc-col-code">
            <span className="hrc-col-label">Código de indicação</span>
            <div className="hrc-field-wrap">
              <code className="hrc-field-value hrc-field-code">{code}</code>
              <button
                type="button"
                className={`hrc-btn${copiedCode ? ' hrc-btn--done' : ''}`}
                onClick={() => copy(code, setCopiedCode)}
                aria-label="Copiar código de indicação"
                aria-live="polite"
              >
                {copiedCode ? <CheckIcon /> : <CopyIcon />}
                {copiedCode ? 'Copiado!' : 'Copiar código'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rodapé informativo */}
      <p className="hrc-footnote">
        Compartilhe seu link ou código e você recebe <strong>10%</strong> de comissão por cada indicado ativo.
      </p>
    </article>
  );
}
