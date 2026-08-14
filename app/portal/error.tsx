'use client';

import { useEffect } from 'react';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Portal Error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="portal-page">
      <section className="portal-shell" style={{ padding: '2rem' }}>
        <div style={{
          maxWidth: '420px',
          margin: '3rem auto',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.7)',
        }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 1rem',
            borderRadius: '50%',
            background: 'rgba(248,113,113,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          </div>
          <h2 style={{ color: '#f1f5f9', fontSize: '1.1rem', marginBottom: '0.5rem', fontWeight: 600 }}>
            Algo deu errado
          </h2>
          <p style={{ fontSize: '0.78rem', lineHeight: 1.6, marginBottom: '1.5rem', color: 'rgba(255,255,255,0.45)' }}>
            Houve um erro ao carregar esta página. Tente novamente.
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.65rem', marginBottom: '1rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
              ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              background: 'rgba(56,189,248,0.12)',
              border: '1px solid rgba(56,189,248,0.25)',
              color: '#38bdf8',
              padding: '0.55rem 1.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(56,189,248,0.2)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(56,189,248,0.12)')}
          >
            Tentar novamente
          </button>
        </div>
      </section>
    </div>
  );
}
