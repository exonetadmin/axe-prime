'use client';

import { useEffect } from 'react';

export default function PortalPerfilError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Portal Perfil Error]', error.message, error.digest, error.stack);
  }, [error]);

  return (
    <div className="portal-page">
      <section className="portal-shell">
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '0.85rem',
        }}>
          <h2 style={{ color: '#f87171', marginBottom: '1rem', fontSize: '1.1rem' }}>
            Erro ao carregar o perfil
          </h2>
          <p style={{ marginBottom: '0.5rem' }}>
            Digest: <code style={{ color: '#38bdf8' }}>{error.digest ?? 'N/A'}</code>
          </p>
          <p style={{ marginBottom: '1.5rem', color: 'rgba(255,255,255,0.4)' }}>
            {error.message || 'Erro no servidor'}
          </p>
          <button
            onClick={reset}
            style={{
              background: 'rgba(56,189,248,0.15)',
              border: '1px solid rgba(56,189,248,0.3)',
              color: '#38bdf8',
              padding: '0.5rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            Tentar novamente
          </button>
        </div>
      </section>
    </div>
  );
}
