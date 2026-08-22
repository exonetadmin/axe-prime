'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  disableAdminTotpAction,
  confirmAdminTotpEnrollmentAction,
  startAdminTotpEnrollmentAction,
} from '@/app/admin/actions';
import {
  ShieldCheck,
  Smartphone,
  Lock,
  PlayCircle,
  Copy,
  CircleHelp,
  TimerReset,
  LogOut,
} from 'lucide-react';

type EnrollmentStartResult =
  | null
  | { ok: false; error: string }
  | { ok: true; secret: string; otpauthUri: string };

type EnrollmentConfirmResult = null | { ok: boolean; message: string; reauth?: boolean };

type EnrollmentStep = 'idle' | 'confirming';

function formatSecret(secret: string): string {
  return secret.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

function buildQrUrl(value: string): string {
  const data = encodeURIComponent(value);
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=0&format=png&data=${data}`;
}

export default function AdminSegurancaClient({ mfaEnabled }: { mfaEnabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<EnrollmentStep>(mfaEnabled ? 'idle' : 'idle');
  const [enrollmentState, setEnrollmentState] = useState<EnrollmentStartResult>(null);
  const [confirmState, setConfirmState] = useState<EnrollmentConfirmResult>(null);
  const [disableState, setDisableState] = useState<EnrollmentConfirmResult>(null);
  const [copyMessage, setCopyMessage] = useState('');

  const hasEnrollment = step === 'confirming' && enrollmentState && enrollmentState.ok;
  const secret = hasEnrollment ? enrollmentState.secret : '';
  const otpauthUri = hasEnrollment ? enrollmentState.otpauthUri : '';

  function copySecret() {
    void (async () => {
      if (!secret) return;
      try {
        await navigator.clipboard.writeText(secret);
        setCopyMessage('Chave copiada.');
      } catch {
        setCopyMessage('Não foi possível copiar.');
      }
      setTimeout(() => setCopyMessage(''), 1500);
    })();
  }

  function startEnrollment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const result = await startAdminTotpEnrollmentAction(null, new FormData());
      if (result.ok) {
        setEnrollmentState(result);
        setStep('confirming');
        return;
      }
      setEnrollmentState(result);
      setStep('idle');
    });
  }

  function confirmEnrollment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const token = String(formData.get('token') ?? '');
    if (!/^\d{6}$/.test(token)) {
      setConfirmState({ ok: false, message: 'Digite o código de 6 dígitos.' });
      return;
    }

    startTransition(async () => {
      const result = await confirmAdminTotpEnrollmentAction(null, formData);
      setConfirmState(result);
      if (result.ok && result.reauth) {
        router.replace('/admin/login');
      }
    });
  }

  function disableMfa(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await disableAdminTotpAction(null, formData);
      setDisableState(result);
      if (result.ok && result.reauth) {
        router.replace('/admin/login');
      }
    });
  }

  return (
    <div className="adm-cfg-grid">
      <section className="adm-card" style={{ gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <ShieldCheck size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />
          <h2 className="adm-card-title" style={{ margin: 0 }}>
            Autenticação em duas etapas (TOTP)
          </h2>
        </div>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-soft)', marginBottom: '1rem' }}>
          A autenticação em duas etapas adiciona segurança ao painel e é recomendada para todos os
          administradores.
        </p>

        {mfaEnabled ? (
          <div>
            <p
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.84rem',
                padding: '0.45rem 0.6rem',
                borderRadius: '999px',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                color: '#6ee7b7',
                marginBottom: '1rem',
              }}
            >
              <ShieldCheck size={13} strokeWidth={2.2} />
              Status: MFA ativo
            </p>

            <p style={{ margin: '0 0 0.7rem', fontSize: '0.78rem', color: 'var(--text-soft)' }}>
              Para desativar, digite <strong>desativar</strong> abaixo.
            </p>

            <form onSubmit={disableMfa} style={{ display: 'grid', gap: '0.7rem', maxWidth: 320 }}>
              <input
                type="text"
                name="confirm"
                required
                disabled={pending}
                className="adm-input"
                placeholder='digite "desativar"'
                autoComplete="off"
              />
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="submit"
                  disabled={pending}
                  className="adm-btn adm-btn--danger"
                  style={{ gap: '0.3rem', width: 190 }}
                >
                  <Lock size={12} strokeWidth={2} />
                  {pending ? 'Desativando…' : 'Desativar MFA'}
                </button>
              </div>
              {disableState && (
                <p
                  className={disableState.ok ? 'adm-cfg-ok' : 'adm-cfg-error'}
                  style={{ margin: 0, fontSize: '0.74rem' }}
                >
                  {disableState.message}
                </p>
              )}
            </form>
          </div>
        ) : (
          <div>
            <p
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.84rem',
                padding: '0.45rem 0.6rem',
                borderRadius: '999px',
                border: '1px solid rgba(248, 113, 113, 0.2)',
                color: '#fca5a5',
                marginBottom: '1rem',
              }}
            >
              <CircleHelp size={13} strokeWidth={2.2} />
              Status: MFA não configurado
            </p>

            {!hasEnrollment && (
              <div>
                <form onSubmit={startEnrollment}>
                  <button
                    type="submit"
                    disabled={pending}
                    className="adm-btn adm-btn--primary"
                    style={{ gap: '0.3rem', display: 'inline-flex', alignItems: 'center' }}
                  >
                    <Smartphone size={13} strokeWidth={2} />
                    {pending ? 'Gerando QR…' : 'Cadastrar no autenticador'}
                  </button>
                </form>
                <p
                  className={enrollmentState && !enrollmentState.ok ? 'adm-cfg-error' : 'adm-cfg-note'}
                  style={{
                    marginTop: '0.7rem',
                    marginBottom: 0,
                    fontSize: '0.76rem',
                    color: enrollmentState && !enrollmentState.ok ? '#f87171' : 'var(--text-soft)',
                  }}
                >
                  {enrollmentState && !enrollmentState.ok
                    ? enrollmentState.error
                    : 'Após iniciar, escaneie o QR Code no app autenticador e confirme o código de 6 dígitos.'}
                </p>
              </div>
            )}

            {hasEnrollment && (
              <div style={{ display: 'grid', gap: '0.85rem' }}>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <div style={{ display: 'grid', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)' }}>
                      QR code para cadastrar no app autenticador
                    </span>
                    <div
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: '0.7rem',
                        padding: '0.7rem',
                        width: 280,
                        background: 'rgba(255, 255, 255, 0.02)',
                        textAlign: 'center',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={buildQrUrl(otpauthUri)}
                        alt="QR Code do MFA"
                        style={{ width: 250, height: 250 }}
                        loading="lazy"
                      />
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.4rem',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)' }}>
                        Chave (manual):
                      </span>
                      <button
                        type="button"
                        onClick={copySecret}
                        className="adm-btn adm-btn--ghost"
                        style={{ gap: '0.3rem', padding: '0.32rem 0.5rem', fontSize: '0.72rem' }}
                      >
                        <Copy size={12} strokeWidth={2} />
                        Copiar
                      </button>
                    </div>
                    <p
                      style={{
                        marginTop: '0.35rem',
                        marginBottom: 0,
                        fontFamily: 'monospace',
                        fontSize: '0.9rem',
                        wordBreak: 'break-all',
                        letterSpacing: '0.08rem',
                      }}
                    >
                      {formatSecret(secret)}
                    </p>
                    {copyMessage && (
                      <p className="adm-cfg-ok" style={{ margin: '0.4rem 0 0', fontSize: '0.72rem' }}>
                        {copyMessage}
                      </p>
                    )}
                  </div>
                </div>

                <form onSubmit={confirmEnrollment} style={{ display: 'grid', gap: '0.6rem', maxWidth: 280 }}>
                  <label htmlFor="admin-mfa-token" className="adm-login-label">
                    Digite o código de 6 dígitos do autenticador
                  </label>
                  <input
                    id="admin-mfa-token"
                    type="text"
                    name="token"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    autoComplete="one-time-code"
                    className="adm-input"
                    placeholder="000000"
                    disabled={pending}
                    pattern="\\d*"
                    style={{ letterSpacing: '0.18rem' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="submit"
                      disabled={pending}
                      className="adm-btn adm-btn--success"
                      style={{ gap: '0.3rem', width: 170 }}
                    >
                      <PlayCircle size={12} strokeWidth={2} />
                      {pending ? 'Validando…' : 'Validar e ativar'}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="adm-btn adm-btn--ghost"
                      style={{ width: 135 }}
                      onClick={() => {
                        setStep('idle');
                        setEnrollmentState(null);
                      }}
                    >
                      <TimerReset size={12} strokeWidth={2} />
                      Refazer
                    </button>
                  </div>
                  {confirmState && (
                    <p
                      className={confirmState.ok ? 'adm-cfg-ok' : 'adm-cfg-error'}
                      style={{ margin: '0', fontSize: '0.74rem' }}
                    >
                      {confirmState.message}
                    </p>
                  )}
                </form>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="adm-card" style={{ gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem' }}>
          <LogOut size={14} strokeWidth={2} style={{ color: 'var(--text-soft)' }} />
          <h3 className="adm-card-title" style={{ margin: 0 }}>
            Segurança da sessão
          </h3>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-soft)', margin: 0 }}>
          Sempre encerre a sessão após o uso em terminais compartilhados e mantenha a senha de acesso em
          sigilo.
        </p>
      </section>
    </div>
  );
}
