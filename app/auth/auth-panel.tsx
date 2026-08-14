'use client';

import { startTransition, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Toast } from '@/components/toast';
import { authScreenCopy, type AuthModeKey } from '@/lib/access-copy';
import { markPortalEntryIntent } from '@/lib/portal-entry';

type AuthMode = AuthModeKey;

type AuthPanelProps = {
  initialMode: AuthMode;
  /** Referral code from URL (e.g. /auth?ref=CODE). Sent on register to link new user to sponsor. */
  initialReferralCode?: string | null;
};

type RegisterState = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

type LoginState = {
  email: string;
  password: string;
};

type ResetRequestState = {
  email: string;
};

type NewPasswordState = {
  password: string;
  confirmPassword: string;
};

type AuthResponsePayload = {
  error?: string;
  message?: string;
  user?: {
    name?: string;
  };
} | null;

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 6) return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
  if (d.length > 2) return d.replace(/(\d{2})(\d{0,5})/, '($1) $2');
  return d;
}

const initialRegisterState: RegisterState = {
  name: '',
  email: '',
  phone: '',
  password: '',
};

const initialLoginState: LoginState = {
  email: '',
  password: '',
};

const initialResetRequestState: ResetRequestState = {
  email: '',
};

const initialNewPasswordState: NewPasswordState = {
  password: '',
  confirmPassword: '',
};

const REFERRAL_STORAGE_KEY = 'axe.referralCode';

export default function AuthPanel({
  initialMode,
  initialReferralCode = null,
}: AuthPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [referralCode, setReferralCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return initialReferralCode ?? null;
    return (
      initialReferralCode ??
      sessionStorage.getItem(REFERRAL_STORAGE_KEY)
    );
  });

  useEffect(() => {
    if (initialReferralCode) {
      setReferralCode(initialReferralCode);
      try {
        sessionStorage.setItem(REFERRAL_STORAGE_KEY, initialReferralCode);
      } catch {
        // ignore
      }
    }
  }, [initialReferralCode]);
  const [loginState, setLoginState] = useState<LoginState>(initialLoginState);
  const [registerState, setRegisterState] = useState<RegisterState>(initialRegisterState);
  const [resetRequestState, setResetRequestState] =
    useState<ResetRequestState>(initialResetRequestState);
  const [newPasswordState, setNewPasswordState] =
    useState<NewPasswordState>(initialNewPasswordState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginState),
      });

      const payload = (await response.json().catch(() => null)) as AuthResponsePayload;

      if (!response.ok) {
        setError(payload?.error ?? 'Não foi possível concluir o login.');
        return;
      }

      setSuccess(payload?.message ?? 'Login realizado com sucesso.');
      markPortalEntryIntent('login', payload?.user?.name ?? loginState.email);

      startTransition(() => {
        router.push('/portal');
        router.refresh();
      });
    } finally {
      setPending(false);
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sponsorCode = (referralCode ?? '').trim();
    if (!sponsorCode) {
      setError(authScreenCopy.registerSponsorCode.requiredError);
      return;
    }
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: registerState.name,
          email: registerState.email,
          phone: registerState.phone,
          password: registerState.password,
          referralCode: sponsorCode,
        }),
      });

      const payload = (await response.json().catch(() => null)) as AuthResponsePayload;

      if (!response.ok) {
        setError(payload?.error ?? 'Não foi possível concluir o cadastro.');
        return;
      }

      setSuccess(payload?.message ?? 'Cadastro realizado com sucesso.');
      markPortalEntryIntent('register', payload?.user?.name ?? registerState.name);
      try {
        sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
      } catch {
        // ignore
      }

      startTransition(() => {
        router.push('/portal/planos');
        router.refresh();
      });
    } finally {
      setPending(false);
    }
  };

  const handleResetRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resetRequestState),
      });

      const payload = (await response.json().catch(() => null)) as AuthResponsePayload;

      if (!response.ok) {
        setError(payload?.error ?? 'Não foi possível solicitar a recuperação.');
        return;
      }

      setSuccess(payload?.message ?? 'Instruções enviadas para seu e-mail.');
    } finally {
      setPending(false);
    }
  };

  const handleNewPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const token = new URLSearchParams(window.location.search).get('token');

    if (!token) {
      setError('Token não encontrado. Use o link do e-mail.');
      setPending(false);
      return;
    }

    try {
      const response = await fetch(`/api/auth/reset/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPasswordState),
      });

      const payload = (await response.json().catch(() => null)) as AuthResponsePayload;

      if (!response.ok) {
        setError(payload?.error ?? 'Não foi possível redefinir a senha.');
        return;
      }

      setSuccess(payload?.message ?? 'Senha redefinida com sucesso.');
      setTimeout(() => {
        startTransition(() => {
          router.push('/auth');
        });
      }, 2000);
    } finally {
      setPending(false);
    }
  };

  const dismissToast = useCallback(() => setSuccess(null), []);
  const modeCopy = authScreenCopy.modes[mode];

  return (
    <div className="auth-card">
      {success ? <Toast message={success} onDismiss={dismissToast} /> : null}
      <span className="section-label">{authScreenCopy.panelLabel}</span>
      <h2 className="auth-panel-title">{modeCopy.title}</h2>
      <p className="auth-panel-copy">{modeCopy.description}</p>

      <div className="auth-tabs-wrap">
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab${mode === 'login' ? ' is-active' : ''}`}
            onClick={() => {
              setMode('login');
              setError(null);
              setSuccess(null);
            }}
          >
            {authScreenCopy.tabs.login}
          </button>
          <button
            type="button"
            className={`auth-tab${mode === 'register' ? ' is-active' : ''}`}
            onClick={() => {
              setMode('register');
              setError(null);
              setSuccess(null);
            }}
          >
            {authScreenCopy.tabs.register}
          </button>
        </div>
      </div>

      {mode === 'login' ? (
        <form className="form-grid" onSubmit={handleLogin}>
          <div className="field">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email"
              value={loginState.email}
              onChange={event =>
                setLoginState(current => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="voce@axeprime.com.br"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={loginState.password}
              onChange={event =>
                setLoginState(current => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="Mínimo de 8 caracteres"
              required
            />
          </div>

          <button type="submit" className="primary-button" disabled={pending}>
            {pending ? 'Entrando...' : authScreenCopy.modes.login.submitLabel}
          </button>

          <p className="auth-note auth-note-centered">
            <button type="button" className="inline-link-button" onClick={() => setMode('reset')}>
              Esqueceu a senha?
            </button>
          </p>
        </form>
      ) : mode === 'register' ? (
        <form className="form-grid" onSubmit={handleRegister}>
          <div className="field">
            <label htmlFor="register-sponsor-code">
              {authScreenCopy.registerSponsorCode.label}
            </label>
            <input
              id="register-sponsor-code"
              type="text"
              name="sponsorCode"
              autoComplete="off"
              value={referralCode ?? ''}
              onChange={e => setReferralCode(e.target.value.trim() || null)}
              placeholder={authScreenCopy.registerSponsorCode.placeholder}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="register-name">Nome completo</label>
            <input
              id="register-name"
              type="text"
              name="name"
              autoComplete="name"
              value={registerState.name}
              onChange={event =>
                setRegisterState(current => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Seu nome"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="register-email">E-mail</label>
            <input
              id="register-email"
              type="email"
              name="email"
              autoComplete="email"
              value={registerState.email}
              onChange={event =>
                setRegisterState(current => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="voce@axeprime.com.br"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="register-phone">Telefone / Celular</label>
            <input
              id="register-phone"
              type="tel"
              name="phone"
              autoComplete="tel"
              inputMode="numeric"
              value={registerState.phone}
              onChange={event =>
                setRegisterState(current => ({
                  ...current,
                  phone: maskPhone(event.target.value),
                }))
              }
              placeholder="(11) 99999-9999"
              maxLength={15}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="register-password">Senha</label>
            <input
              id="register-password"
              type="password"
              name="password"
              autoComplete="new-password"
              value={registerState.password}
              onChange={event =>
                setRegisterState(current => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="Crie uma senha segura"
              required
            />
          </div>

          <button type="submit" className="primary-button" disabled={pending}>
            {pending ? 'Criando acesso...' : authScreenCopy.modes.register.submitLabel}
          </button>
        </form>
      ) : (mode as string) === 'reset' ? (
        <form className="form-grid" onSubmit={handleResetRequest}>
          <div className="field">
            <label htmlFor="reset-email">E-mail cadastrado</label>
            <input
              id="reset-email"
              type="email"
              name="email"
              autoComplete="email"
              value={resetRequestState.email}
              onChange={event =>
                setResetRequestState(current => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              placeholder="voce@axeprime.com.br"
              required
            />
          </div>

          <button type="submit" className="primary-button" disabled={pending}>
            {pending ? 'Enviando...' : authScreenCopy.modes.reset.submitLabel}
          </button>

          <p className="auth-note auth-note-centered">
            <button
              type="button"
              className="inline-link-button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccess(null);
              }}
            >
              {authScreenCopy.modes.reset.secondaryLabel}
            </button>
          </p>
        </form>
      ) : (mode as string) === 'new-password' ? (
        <form className="form-grid" onSubmit={handleNewPassword}>
          <div className="field">
            <label htmlFor="new-password">Nova senha</label>
            <input
              id="new-password"
              type="password"
              name="password"
              autoComplete="new-password"
              value={newPasswordState.password}
              onChange={event =>
                setNewPasswordState(current => ({
                  ...current,
                  password: event.target.value,
                }))
              }
              placeholder="Mínimo de 8 caracteres"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="confirm-password">Confirme a senha</label>
            <input
              id="confirm-password"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={newPasswordState.confirmPassword}
              onChange={event =>
                setNewPasswordState(current => ({
                  ...current,
                  confirmPassword: event.target.value,
                }))
              }
              placeholder="Repita a senha"
              required
            />
          </div>

          <button type="submit" className="primary-button" disabled={pending}>
            {pending ? 'Redefinindo...' : authScreenCopy.modes['new-password'].submitLabel}
          </button>
        </form>
      ) : null}

      {error ? <p className="form-feedback is-error">{error}</p> : null}

      <p className="auth-note">{authScreenCopy.footerNote}</p>
    </div>
  );
}
