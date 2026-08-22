'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  adminLoginAction,
  adminLoginTotpAction,
} from '../actions';
import { ArrowRight, KeyRound, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import type { AdminLoginResult } from '@/src/features/admin/admin.auth';

type TotpState =
  | {
      step: 'credentials';
      challengeToken?: undefined;
      userName?: undefined;
    }
  | {
      step: 'totp';
      challengeToken: string;
      userName: string;
    };

export default function AdminLoginForm() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<TotpState>({
    step: 'credentials',
  });
  function handleCredentialsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = (await adminLoginAction(data)) as AdminLoginResult;
      if (result.ok) {
        router.push(result.redirectTo);
        return;
      }

      if ('requiresTotp' in result) {
        setState({
          step: 'totp',
          challengeToken: result.challengeToken,
          userName: result.userName,
        });
        return;
      }

      if (!result.ok && 'error' in result) {
        setError(result.error);
      }
    });
  }

  function handleTotpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const challengeToken = state.step === 'totp' ? state.challengeToken : '';
    if (challengeToken) {
      data.set('challengeToken', challengeToken);
    }
    startTransition(async () => {
      const result = await adminLoginTotpAction(data);
      if (result.ok) {
        router.push(result.redirectTo);
        return;
      }
      if (result.error) setError(result.error);
    });
  }

  function backToCredentials() {
    setError(null);
    setState({ step: 'credentials' });
  }

  return (
    <form
      onSubmit={state.step === 'credentials' ? handleCredentialsSubmit : handleTotpSubmit}
      className="adm-login-form"
      autoComplete="off"
      noValidate
    >
      {state.step === 'credentials' ? (
        <>
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
        </>
      ) : (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <p className="adm-login-card-sub" style={{ marginTop: 0 }}>
              Olá, <strong>{state.userName}</strong>. Digite o código do seu app autenticador para
              concluir o acesso.
            </p>
            <div
              style={{
                display: 'flex',
                gap: '0.55rem',
                alignItems: 'center',
                color: 'var(--text-soft)',
                fontSize: '0.74rem',
              }}
            >
              <ShieldCheck size={14} />
              <span>2FA (autenticação em duas etapas)</span>
            </div>
          </div>

          <input type="hidden" name="challengeToken" value={state.challengeToken} />

          <div className="adm-login-field">
            <label htmlFor="adm-totp" className="adm-login-label">
              Token de verificação
            </label>
            <div style={{ position: 'relative' }}>
              <LockKeyhole
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
                id="adm-totp"
                name="token"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                className="adm-login-input"
                placeholder="000000"
                disabled={pending}
                pattern="\\d*"
                style={{ paddingLeft: '2.75rem', letterSpacing: '0.14rem' }}
              />
            </div>
          </div>
        </>
      )}

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
            {state.step === 'credentials' ? 'Acessar painel' : 'Validar token'}
            <ArrowRight size={15} strokeWidth={2} />
          </>
        )}
      </button>

      {state.step === 'totp' && (
        <button
          type="button"
          className="adm-login-submit"
          onClick={backToCredentials}
          style={{ marginTop: '0.65rem', background: 'transparent', color: 'var(--text)' }}
          disabled={pending}
        >
          Voltar ao login
        </button>
      )}

      <style>{`
        @keyframes adm-spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
}
