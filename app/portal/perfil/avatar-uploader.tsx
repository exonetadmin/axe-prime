'use client';

import { useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface AvatarUploaderProps {
  /** URL atual do avatar (null = sem foto) */
  currentUrl: string | null;
  /** Nome para gerar as iniciais de fallback */
  name: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function AvatarUploader({ currentUrl, name }: AvatarUploaderProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview local imediato
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setError(null);

    const formData = new FormData();
    formData.append('avatar', file);

    startTransition(async () => {
      const res = await fetch('/api/perfil/avatar', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Erro ao fazer upload.');
        setPreview(currentUrl); // reverte
        return;
      }
      setPreview(data.avatarUrl);
      router.refresh(); // atualiza dados do servidor
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      await fetch('/api/perfil/avatar', { method: 'DELETE' });
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.refresh();
    });
  }

  return (
    <div className="avatar-uploader">
      {/* Círculo do avatar */}
      <div
        className="avatar-uploader-circle"
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Alterar foto de perfil"
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
      >
        {preview ? (
          <Image
            src={preview}
            alt="Foto de perfil"
            fill
            sizes="96px"
            className="avatar-uploader-img"
            unoptimized={preview.startsWith('blob:')}
          />
        ) : (
          <span className="avatar-uploader-initials">{getInitials(name)}</span>
        )}

        {/* Overlay de edição */}
        <div className="avatar-uploader-overlay" aria-hidden>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <span>Alterar</span>
        </div>

        {isPending && (
          <div className="avatar-uploader-loading" aria-hidden>
            <div className="avatar-uploader-spinner" />
          </div>
        )}
      </div>

      {/* Input oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="avatar-uploader-input"
        aria-label="Selecionar foto de perfil"
      />

      {/* Ações */}
      <div className="avatar-uploader-actions">
        <button
          type="button"
          className="avatar-uploader-btn avatar-uploader-btn--primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending}
        >
          {preview ? 'Trocar foto' : 'Adicionar foto'}
        </button>

        {preview && (
          <button
            type="button"
            className="avatar-uploader-btn avatar-uploader-btn--ghost"
            onClick={handleRemove}
            disabled={isPending}
          >
            Remover
          </button>
        )}
      </div>

      {error && <p className="avatar-uploader-error">{error}</p>}
      <p className="avatar-uploader-hint">JPEG, PNG, WebP ou GIF · Máx. 5 MB</p>
    </div>
  );
}
