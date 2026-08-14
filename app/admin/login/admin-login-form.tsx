'use client';

import { useTransition, useRef, useState } from 'react';
import { adminLoginAction } from '../actions';
import { Mail, KeyRound, ArrowRight, Loader2 } from 'lucide-react';

export default function AdminLoginForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await adminLoginAction(data);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="adm-login-form"
      autoComplete="off"
      noValidate
    >
      {/* E-mail */}
      <div className="adm-login-field">
        <label htmlFor="adm-email" className="adm-login-label">
          E-mail corporativo
        </label>
        <div style={{ position: 'relative' }}>
          <Mail
            size={14}
            strokeWidth={1.5}
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-soft)',
              pointerEvents: 'none',
            }}
          />
          <input
            id="adm-email"
            name="email"
            type="email"
            required
            autoFocus
            className="adm-login-input"
            placeholder="email@axeprime.com.br"
            disabled={pending}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
      </div>

      {/* Senha */}
      <div className="adm-login-field">
        <label htmlFor="adm-password" className="adm-login-label">
          Senha
        </label>
        <div style={{ position: 'relative' }}>
          <KeyRound
            size={14}
            strokeWidth={1.5}
            style={{
              position: 'absolute',
              left: '1rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-soft)',
              pointerEvents: 'none',
            }}
          />
          <input
            id="adm-password"
            name="password"
            type="password"
            required
            className="adm-login-input"
            placeholder="••••••••"
            disabled={pending}
            style={{ paddingLeft: '2.75rem' }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="adm-login-error" role="alert">
          {error}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        className="adm-login-submit"
      >
        {pending ? (
          <>
            <Loader2 size={15} strokeWidth={2} style={{ animation: 'adm-spin 1s linear infinite' }} />
            Autenticando…
          </>
        ) : (
          <>
            Acessar Painel
            <ArrowRight size={15} strokeWidth={2} />
          </>
        )}
      </button>

      <style>{`
        @keyframes adm-spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
}
