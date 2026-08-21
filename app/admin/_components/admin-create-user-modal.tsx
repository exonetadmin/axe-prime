'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserAction } from '@/app/admin/admin.actions';
import { UserPlus, X, Eye, EyeOff, Copy, CheckCircle2, Loader2 } from 'lucide-react';

type Props = { onClose: () => void };

export function AdminCreateUserModal({ onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [state, action, pending] = useActionState(createUserAction, null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // Fecha se clicar no backdrop
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === ref.current) onClose();
  }

  function copyCode() {
    if (!state?.referralCode) return;
    navigator.clipboard.writeText(state.referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDone() {
    router.refresh();
    onClose();
  }

  return (
    <dialog ref={ref} className="eum-dialog" onClick={handleBackdrop}>
      <div className="eum-wrap">
        {/* ── Header ────────────────────────────────────────── */}
        <header className="eum-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <div className="eum-avatar eum-avatar--create" style={{ flexShrink: 0 }}>
              <UserPlus size={18} />
            </div>
            <div className="eum-header-left">
              <p className="eum-title">Novo Usuário</p>
              <p className="eum-subtitle">Criar conta manualmente</p>
            </div>
          </div>
          <button type="button" className="eum-close" aria-label="Fechar" onClick={onClose}>
            <X size={15} />
          </button>
        </header>

        {/* ── Estado de SUCESSO ─────────────────────────────── */}
        {state?.ok ? (
          <div className="cum-success">
            <div className="cum-success-icon">
              <CheckCircle2 size={40} strokeWidth={1.5} />
            </div>
            <p className="cum-success-title">Usuário criado!</p>
            <p className="cum-success-sub">Código de patrocinador gerado automaticamente:</p>

            <div className="cum-code-box">
              <span className="cum-code-value">{state.referralCode}</span>
              <button
                type="button"
                className="cum-code-copy"
                onClick={copyCode}
                title="Copiar código"
              >
                {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            <p className="cum-success-hint">
              Este código permite que o usuário indique novos membros.
            </p>

            <button
              type="button"
              className="eum-btn eum-btn--primary"
              style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}
              onClick={handleDone}
            >
              Concluído
            </button>
          </div>
        ) : (
          /* ── Formulário ───────────────────────────────────── */
          <form action={action} className="eum-body" autoComplete="off">
            <div className="eum-grid" style={{ gridTemplateColumns: '1fr' }}>
              {/* Nome completo */}
              <div className="eum-field eum-field--full">
                <label className="eum-label" htmlFor="cum-name">
                  Nome completo <span className="eum-required">*</span>
                </label>
                <input
                  id="cum-name"
                  name="name"
                  type="text"
                  className="eum-input"
                  placeholder="Ex: João da Silva"
                  required
                  minLength={2}
                  autoComplete="off"
                />
              </div>

              {/* E-mail */}
              <div className="eum-field eum-field--full">
                <label className="eum-label" htmlFor="cum-email">
                  E-mail <span className="eum-required">*</span>
                </label>
                <input
                  id="cum-email"
                  name="email"
                  type="email"
                  className="eum-input"
                  placeholder="joao@email.com"
                  required
                  autoComplete="off"
                />
              </div>

              {/* Senha */}
              <div className="eum-field eum-field--full">
                <label className="eum-label" htmlFor="cum-password">
                  Senha <span className="eum-required">*</span>
                </label>
                <div className="cum-password-wrap">
                  <input
                    id="cum-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="eum-input cum-password-input"
                    placeholder="Entre 15 e 128 caracteres"
                    required
                    minLength={15}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="cum-toggle-pwd"
                    onClick={() => setShowPassword(p => !p)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="eum-hint">Use uma frase-senha longa, com 15 a 128 caracteres.</p>
              </div>

              {/* Código de patrocinador */}
              <div className="cum-info-box">
                <span className="cum-info-icon">🔗</span>
                <p className="cum-info-text">
                  O código de patrocinador <strong>AP-XXXXXXXX</strong> será gerado automaticamente
                  após o cadastro.
                </p>
              </div>
            </div>

            {/* Erro de server action */}
            {state && !state.ok && (
              <div className="eum-toast eum-toast--error" role="alert">
                {state.message}
              </div>
            )}

            {/* Actions */}
            <div className="eum-actions">
              <button
                type="button"
                className="eum-btn eum-btn--ghost"
                onClick={onClose}
                disabled={pending}
              >
                Cancelar
              </button>
              <button type="submit" className="eum-btn eum-btn--primary" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 size={15} className="eum-spin" /> Criando…
                  </>
                ) : (
                  <>
                    <UserPlus size={15} /> Criar Usuário
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
