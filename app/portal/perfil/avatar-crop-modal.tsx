'use client';

/**
 * AvatarCropModal — Popup de recorte circular para foto de perfil
 * Design System: AXE PRIME dark / glassmorphism
 * Usa react-easy-crop para crop circular com zoom e drag
 */

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Cropper, { type Area } from 'react-easy-crop';

interface AvatarCropModalProps {
  imageSrc: string;
  onSave: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

/** Cria um canvas circular a partir da imagem e área de crop */
async function getCroppedBlob(imageSrc: string, croppedAreaPixels: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 400; // resolução final do avatar
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Clip circular
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();

      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        size,
        size
      );

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Falha ao gerar imagem recortada.'));
        },
        'image/jpeg',
        0.92
      );
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}

export function AvatarCropModal({ imageSrc, onSave, onCancel }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Garante que o portal só monta no client
  useEffect(() => { setMounted(true); }, []);

  // Bloqueia scroll do body enquanto modal está aberto
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Fecha com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      onSave(blob);
    } catch (err) {
      console.error('[AvatarCropModal] crop error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  const modal = (
    <div className="acm-backdrop" role="dialog" aria-modal="true" aria-label="Recortar foto de perfil">
      <div className="acm-panel">
        {/* Header */}
        <div className="acm-header">
          <div className="acm-header-icon" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
          </div>
          <div>
            <h2 className="acm-title">Recortar Foto</h2>
            <p className="acm-subtitle">Ajuste e centralize seu rosto dentro do círculo</p>
          </div>
          <button
            type="button"
            className="acm-close"
            onClick={onCancel}
            aria-label="Cancelar"
            disabled={saving}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Crop area */}
        <div className="acm-crop-wrap">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            classes={{
              containerClassName: 'acm-cropper-container',
              cropAreaClassName: 'acm-crop-area',
            }}
          />
        </div>

        {/* Zoom slider */}
        <div className="acm-zoom-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
          </svg>
          <input
            type="range"
            className="acm-zoom-slider"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom da foto"
          />
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
          </svg>
        </div>

        {/* Hint */}
        <p className="acm-hint">Arraste para posicionar • Use o controle para zoom</p>

        {/* Actions */}
        <div className="acm-actions">
          <button
            type="button"
            className="acm-btn acm-btn--cancel"
            onClick={onCancel}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="acm-btn acm-btn--save"
            onClick={handleSave}
            disabled={saving || !croppedAreaPixels}
          >
            {saving ? (
              <>
                <span className="acm-spinner" aria-hidden />
                Salvando…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Salvar Foto
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
