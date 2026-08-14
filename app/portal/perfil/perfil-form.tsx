'use client';

/**
 * PerfilForm — Premium Wealth-Management Profile Form
 *
 * Aesthetic direction: Dark Instrumental (Private Banking Terminal)
 * - Gold (#D4AF37) accent on obsidian dark background
 * - Two-column on desktop, single-column on mobile
 * - Avatar circular upload with gold glow elevation
 * - CPF masked input with validation and dynamic status
 */

import { useState, useId, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { AvatarCropModal } from './avatar-crop-modal';
import {
  updateProfileNameAction,
  updateProfileCpfAction,
  updateProfilePasswordAction,
  updateProfileAvatarAction,
  updateProfilePhoneAction,
} from './perfil.actions';

// Mantém referência para clientes com cache antigo não quebrarem
void updateProfileAvatarAction;

/** Ações que podem ser sincronizadas com o painel admin. */
type SyncAction =
  | { type: 'avatar'; payload: { url: string | null } }
  | { type: 'cpf'; payload: { cpf: string } }
  | { type: 'password'; payload: { newPassword: string } }
  | { type: 'basic_info' | 'name_typing'; payload: { name: string } };

/* ═══════════════════════════════════════════════════════════
   CPF UTILITIES
   ═══════════════════════════════════════════════════════════ */

export function maskCpf(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function obscureCpf(masked: string): string {
  const digits = masked.replace(/\D/g, '');
  if (digits.length < 11) return masked;
  return `•••.•••.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function validateCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(.)\1{10}$/.test(d)) return false;

  const calc = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n - 1; i++) sum += parseInt(d[i]!) * (n - i);
    const rem = (sum * 10) % 11;
    return rem === 10 || rem === 11 ? 0 : rem;
  };

  return calc(10) === parseInt(d[9]!) && calc(11) === parseInt(d[10]!);
}

/* ═══════════════════════════════════════════════════════════
   NAME UTILITIES
   ═══════════════════════════════════════════════════════════ */

export function firstAndLast(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/* ═══════════════════════════════════════════════════════════
   ICON COMPONENTS
   ═══════════════════════════════════════════════════════════ */

function IconCamera() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4H9.5L7 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3L14.5 4Z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" className="pf-spinner-svg" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   AVATAR SECTION
   ═══════════════════════════════════════════════════════════ */

interface AvatarSectionProps {
  displayName: string;
  avatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
  syncProfileData: (payload: SyncAction) => void;
}

export function AvatarSection({ displayName, avatarUrl, onAvatarChange, syncProfileData }: AvatarSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null); // imagem para o modal de crop

  const showImg = !!avatarUrl && !imgError;

  // Abre o seletor de arquivo
  const openPicker = useCallback(() => inputRef.current?.click(), []);

  // Quando o usuário seleciona um arquivo, abre o modal de crop
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Arquivo muito grande. Máximo 10 MB.');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
  }, []);

  // Quando confirma o crop, faz upload do blob resultante
  const handleCropSave = useCallback(async (croppedBlob: Blob) => {
    setCropSrc(null);
    setUploadError(null);
    const localUrl = URL.createObjectURL(croppedBlob);
    onAvatarChange(localUrl);
    setImgError(false);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', croppedBlob, 'avatar.jpg');
      const res = await fetch('/api/perfil/avatar', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.avatarUrl) {
        onAvatarChange(data.avatarUrl);
      } else {
        setUploadError(data.error ?? 'Erro ao fazer upload.');
        onAvatarChange(null);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Falha no upload');
      onAvatarChange(null);
    } finally {
      setUploading(false);
    }
  }, [onAvatarChange]);

  const handleCropCancel = useCallback(() => setCropSrc(null), []);

  const initials = displayName
    ? displayName
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  return (
    <div className="pf-avatar-col">
      {/* Modal de crop — renderizado via portal sobre tudo */}
      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          onSave={handleCropSave}
          onCancel={handleCropCancel}
        />
      )}

      {/* Avatar ring */}
      <button
        type="button"
        className="pf-avatar-ring"
        aria-label="Upload foto de perfil"
        onClick={openPicker}
        disabled={uploading}
      >
        {showImg ? (
          <Image
            src={avatarUrl!}
            alt={displayName}
            fill
            sizes="136px"
            className="pf-avatar-img"
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <span className="pf-avatar-initials">
            {initials || <IconUser />}
          </span>
        )}

        <span className="pf-avatar-overlay" aria-hidden>
          <IconCamera />
          <span>{showImg ? 'Alterar' : 'Upload'}</span>
        </span>

        {uploading && (
          <span className="pf-avatar-uploading" aria-hidden>
            <IconSpinner />
          </span>
        )}
      </button>

      {/* Display name */}
      <div className="pf-avatar-nameblock">
        <h2 className="pf-display-name">
          {firstAndLast(displayName) || '—'}
        </h2>
      </div>

      {/* Upload button */}
      <div className="pf-avatar-actions">
        <button
          type="button"
          className="pf-ghost-btn"
          onClick={openPicker}
          disabled={uploading}
        >
          {uploading ? 'Enviando…' : showImg ? 'Alterar Foto' : 'Adicionar Foto'}
        </button>
      </div>

      {uploadError && (
        <p className="pf-upload-error">{uploadError}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="pf-hidden-input"
        aria-hidden
        onChange={handleFileSelect}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   FIELD COMPONENT
   ═══════════════════════════════════════════════════════════ */

interface FieldProps {
  id: string;
  label: string;
  helper?: string;
  children: React.ReactNode;
}

export function Field({ id, label, helper, children }: FieldProps) {
  return (
    <div className="pf-field">
      <label htmlFor={id} className="pf-label">{label}</label>
      {children}
      {helper && <span className="pf-field-helper">{helper}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CPF INPUT
   ═══════════════════════════════════════════════════════════ */

interface CpfInputProps {
  id: string;
  initialCpf: string | null;
  syncProfileData: (payload: SyncAction) => void;
}

export function CpfInput({ id, initialCpf, syncProfileData }: CpfInputProps) {
  const initialDigits = (initialCpf ?? '').replace(/\D/g, '').slice(0, 11);
  const [raw, setRaw] = useState(initialDigits);
  const [masked, setMasked] = useState(maskCpf(initialDigits));
  const [editing, setEditing] = useState(false);
  const [touched, setTouched] = useState(false);
  const [cpfSaved, setCpfSaved] = useState(!!initialDigits);

  const digits = raw.replace(/\D/g, '');
  const isFilled = digits.length === 11;
  const isValid = isFilled && validateCpf(digits);
  const isInvalid = touched && isFilled && !isValid;
  const showStatus = touched && isFilled;

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDigits = e.target.value.replace(/\D/g, '').slice(0, 11);
    setRaw(newDigits);
    setMasked(maskCpf(newDigits));
    setTouched(true);
    setCpfSaved(false);

    if (newDigits.length === 11 && validateCpf(newDigits)) {
      syncProfileData({ type: 'cpf', payload: { cpf: newDigits } });
      const result = await updateProfileCpfAction(newDigits);
      if (result.ok) setCpfSaved(true);
    }
  };

  const displayValue = editing
    ? masked
    : masked && !editing
      ? obscureCpf(masked)
      : '';

  const wrapClass = [
    'pf-input-wrap',
    isInvalid ? 'pf-input-wrap--error' : '',
    isValid && touched ? 'pf-input-wrap--valid' : '',
  ].filter(Boolean).join(' ');

  return (
    <div>
      <div className={wrapClass}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={displayValue}
          placeholder="000.000.000-00"
          className="pf-input pf-input--cpf"
          onFocus={() => setEditing(true)}
          onBlur={() => {
            setEditing(false);
            if (digits.length > 0) setTouched(true);
          }}
          onChange={handleChange}
          autoComplete="off"
          aria-invalid={isInvalid ? 'true' : undefined}
          aria-describedby={touched ? `${id}-status` : undefined}
        />
        {showStatus && (
          <span
            id={`${id}-status`}
            className={`pf-cpf-status ${isValid ? 'pf-cpf-status--ok' : 'pf-cpf-status--err'}`}
            aria-label={isValid ? 'CPF válido' : 'CPF inválido'}
          >
            {isValid ? <IconCheck /> : <IconAlert />}
          </span>
        )}
      </div>
      {showStatus && (
        <p style={{ fontSize: '0.7rem', marginTop: '0.35rem', color: isValid ? '#34d399' : '#f87171' }}>
          {isValid ? 'CPF válido' : 'CPF inválido'}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PASSWORD INPUT
   ═══════════════════════════════════════════════════════════ */

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export function PasswordInput({ id, value, onChange, placeholder }: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="pf-input-wrap">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '••••••••'}
        className="pf-input"
        style={{ paddingRight: '3rem' }}
      />
      <button
        type="button"
        className="pf-eye-btn"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
      >
        {show ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SECURITY SECTION
   ═══════════════════════════════════════════════════════════ */

export function SecuritySection({ syncProfileData }: { syncProfileData: (payload: SyncAction) => void }) {
  const curPassId = useId();
  const newPassId = useId();
  const confPassId = useId();

  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confPass, setConfPass] = useState('');
  const [passFeedback, setPassFeedback] = useState<string | null>(null);
  const [passLoading, setPassLoading] = useState(false);

  const canUpdate = curPass.length > 0 && newPass.length >= 8 && newPass === confPass;

  const handleChangeSenha = async () => {
    if (!canUpdate) return;
    setPassLoading(true);
    setPassFeedback(null);
    try {
      const result = await updateProfilePasswordAction(curPass, newPass);
      setPassFeedback(result.message);
      if (result.ok) {
        setCurPass('');
        setNewPass('');
        setConfPass('');
      }
    } catch {
      setPassFeedback('Erro inesperado.');
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="pf-section">
      <span className="pf-section-label">Segurança</span>

      <Field id={curPassId} label="Senha Atual">
        <PasswordInput id={curPassId} value={curPass} onChange={setCurPass} />
      </Field>

      <div className="pf-two-col">
        <Field id={newPassId} label="Nova Senha" helper="Mínimo de 8 caracteres.">
          <PasswordInput id={newPassId} value={newPass} onChange={setNewPass} />
        </Field>
        <Field id={confPassId} label="Confirmar Nova Senha">
          <PasswordInput id={confPassId} value={confPass} onChange={setConfPass} />
        </Field>
      </div>

      <div className="pf-actions-row">
        <button
          type="button"
          onClick={handleChangeSenha}
          disabled={!canUpdate || passLoading}
          className="pf-change-pass-btn"
        >
          {passLoading ? 'Salvando…' : 'Alterar Senha'}
        </button>
        {passFeedback && (
          <p style={{ fontSize: '0.72rem', marginTop: '0.5rem', color: passFeedback.includes('sucesso') ? '#34d399' : '#f87171' }}>
            {passFeedback}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */

interface PerfilFormProps {
  initialName: string;
  initialEmail: string;
  initialPhone: string | null;
  initialAvatarUrl: string | null;
  initialCpf: string | null;
  planLabel: string;
  joinedAt: string;
  referralCode: string;
}

export function PerfilForm({
  initialName,
  initialEmail,
  initialPhone,
  initialAvatarUrl,
  initialCpf,
  planLabel,
  joinedAt,
  referralCode,
}: PerfilFormProps) {
  const nameId = useId();
  const emailId = useId();
  const phoneId = useId();
  const cpfId = useId();

  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [phoneSaved, setPhoneSaved] = useState(!!initialPhone);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const syncProfileData = useCallback(async (action: SyncAction) => {
    // Dados já são salvos diretamente pelas actions individuais
    console.log('[Profile Sync]', action.type);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const result = await updateProfileNameAction(fullName);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2800);
      } else {
        console.error('[handleSave]', result.message);
      }
    } catch (err) {
      console.error('[handleSave]', err);
    }
    setSaving(false);
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      if (fullName !== initialName) {
        syncProfileData({ type: 'name_typing', payload: { name: fullName } });
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [fullName, initialName, syncProfileData]);

  return (
    <div className="pf-root">
      {/* ── Avatar column ── */}
      <AvatarSection
        displayName={fullName}
        avatarUrl={avatarUrl}
        onAvatarChange={setAvatarUrl}
        syncProfileData={syncProfileData}
      />

      {/* ── Form column ── */}
      <div className="pf-form-col">
        <form onSubmit={handleSave} noValidate>

          {/* ─ Identidade ─ */}
          <div className="pf-section">
            <span className="pf-section-label">Identidade</span>

            <div className="pf-two-col">
              <Field id={nameId} label="Nome Completo" helper="Exibido nos relatórios e comprovantes.">
                <div className="pf-input-wrap">
                  <input
                    id={nameId}
                    type="text"
                    className="pf-input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex.: Eduardo Giffoni Simões"
                    autoComplete="name"
                  />
                </div>
              </Field>

              <Field id={emailId} label="E‑mail" helper="Usado para acesso (imutável).">
                <div className="pf-input-wrap pf-input-wrap--readonly">
                  <input
                    id={emailId}
                    type="email"
                    className="pf-input"
                    defaultValue={initialEmail}
                    readOnly
                    tabIndex={-1}
                    style={{ paddingRight: '4rem' }}
                  />
                  <span className="pf-readonly-badge">Fixo</span>
                </div>
              </Field>
            </div>

            <Field id={phoneId} label="Telefone / Celular" helper="Usado para contato e notificações.">
              <div className={`pf-input-wrap ${phoneSaved ? 'pf-input-wrap--valid' : ''}`}>
                <input
                  id={phoneId}
                  type="tel"
                  inputMode="numeric"
                  className="pf-input"
                  value={phone}
                  onChange={async (e) => {
                    const d = e.target.value.replace(/\D/g, '').slice(0, 11);
                    let masked = d;
                    if (d.length > 6) masked = d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
                    else if (d.length > 2) masked = d.replace(/(\d{2})(\d{0,5})/, '($1) $2');
                    setPhone(masked);
                    setPhoneSaved(false);

                    if (d.length >= 10) {
                      const result = await updateProfilePhoneAction(masked);
                      if (result.ok) setPhoneSaved(true);
                    }
                  }}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  autoComplete="tel"
                />
                {phoneSaved && (
                  <span className="pf-cpf-status pf-cpf-status--ok" aria-label="Salvo">
                    <IconCheck />
                  </span>
                )}
              </div>
            </Field>
          </div>

          {/* ─ Documentação ─ */}
          <div className="pf-section">
            <span className="pf-section-label">Documentação</span>
            <Field id={cpfId} label="CPF" helper="Protegido por máscara. Mantido sob sigilo de Private Banking.">
              <CpfInput id={cpfId} initialCpf={initialCpf} syncProfileData={syncProfileData} />
            </Field>
          </div>

          {/* ─ Conta ─ */}
          <div className="pf-section">
            <span className="pf-section-label">Conta</span>
            <div className="pf-meta-grid">
              <div className="pf-meta-item">
                <span className="pf-meta-key">Plano</span>
                <span className="pf-meta-val">{planLabel}</span>
              </div>
              <div className="pf-meta-item">
                <span className="pf-meta-key">Membro desde</span>
                <span className="pf-meta-val">{joinedAt}</span>
              </div>
              <div className="pf-meta-item">
                <span className="pf-meta-key">Código de indicação</span>
                <span className="pf-meta-val pf-meta-val--code">{referralCode}</span>
              </div>
            </div>
          </div>

        {/* ─ Save bar ─ */}
        <div className="pf-save-bar">
          <button
            type="submit"
            className="pf-save-btn"
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? (
              <><IconSpinner /> Salvando…</>
            ) : saved ? (
              <><IconCheck /> Salvo!</>
            ) : (
              'Salvar Alterações'
            )}
          </button>
        </div>

        </form>

        {/* ─ Segurança ─ */}
        <SecuritySection syncProfileData={syncProfileData} />
      </div>
    </div>
  );
}
