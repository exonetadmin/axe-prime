'use client';

import { useState } from 'react';

/* ─────────────────────────────────────────────────────────────────
   Modal de personalização do Copiloto
   Design: identidade AXE Prime — navy/cyan/glassmorphism
   ───────────────────────────────────────────────────────────────── */

interface Persona {
  display_name: string;
  style: string;
  tone: string;
}

const STYLES = [
  { value: 'direto', label: 'Direto', desc: 'Objetivo, vai ao ponto sem rodeios' },
  { value: 'empatico', label: 'Empático', desc: 'Acolhedor, entende antes de vender' },
  { value: 'desafiador', label: 'Desafiador', desc: 'Provoca e tira da zona de conforto' },
];

const TONES = [
  { value: 'informal', label: 'Informal', desc: 'Como um parceiro que quer te ver crescer' },
  { value: 'formal', label: 'Formal', desc: 'Consultor de alto padrão e assertivo' },
  { value: 'energico', label: 'Enérgico', desc: 'Motivador, intenso e entusiasmado' },
];

export default function CopiloPersonaForm({
  initial,
  onSave,
  onClose,
}: {
  initial: Persona;
  onSave: (updated: Persona) => void;
  onClose: () => void;
}) {
  const [displayName, setDisplayName] = useState(initial.display_name);
  const [style, setStyle] = useState(initial.style);
  const [tone, setTone] = useState(initial.tone);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/copiloto/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName.trim(), style, tone }),
      });
      onSave({ display_name: displayName.trim(), style, tone });
    } catch {
      onSave({ display_name: displayName.trim(), style, tone });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cop-modal-backdrop" onClick={onClose}>
      <div className="cop-modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal aria-label="Personalizar Copiloto">

        {/* Header */}
        <div className="cop-modal-top">
          <div className="cop-modal-heading">
            <div className="cop-modal-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                  fill="rgba(56,189,248,0.15)" stroke="#38bdf8" strokeWidth="1.6"
                  strokeLinejoin="round" />
              </svg>
            </div>
            <span>Personalizar Copiloto</span>
          </div>
          <button type="button" className="cop-modal-x" onClick={onClose} aria-label="Fechar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="cop-modal-content">

          {/* Nome */}
          <div className="cop-field">
            <label className="cop-field-label" htmlFor="cop-name">Nome do Copiloto</label>
            <input
              id="cop-name"
              type="text"
              className="cop-field-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex: Marcos, Leo, Coach…"
              maxLength={30}
              autoFocus
            />
            <p className="cop-field-hint">
              Ele usará esse nome ao se apresentar e assinar as mensagens.
            </p>
          </div>

          {/* Estilo */}
          <div className="cop-field">
            <label className="cop-field-label">Estilo de comunicação</label>
            <div className="cop-opts">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`cop-opt ${style === s.value ? 'cop-opt--on' : ''}`}
                  onClick={() => setStyle(s.value)}
                  aria-pressed={style === s.value}
                >
                  <span className="cop-opt-label">{s.label}</span>
                  <span className="cop-opt-desc">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tom */}
          <div className="cop-field">
            <label className="cop-field-label">Tom da conversa</label>
            <div className="cop-opts">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`cop-opt ${tone === t.value ? 'cop-opt--on' : ''}`}
                  onClick={() => setTone(t.value)}
                  aria-pressed={tone === t.value}
                >
                  <span className="cop-opt-label">{t.label}</span>
                  <span className="cop-opt-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="cop-modal-footer">
          <button type="button" className="cop-modal-btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="cop-modal-btn-save"
            onClick={handleSave}
            disabled={saving || !displayName.trim()}
          >
            {saving ? (
              <span className="cop-btn-spinner" aria-hidden />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
            {saving ? 'Salvando…' : 'Salvar e aplicar'}
          </button>
        </div>
      </div>
    </div>
  );
}
