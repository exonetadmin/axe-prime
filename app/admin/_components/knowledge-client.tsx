'use client';

import { useActionState, useState, useTransition } from 'react';
import {
  Brain, Plus, Pencil, Trash2, Eye, EyeOff, X, Check, Sparkles,
} from 'lucide-react';
import {
  createKnowledgeAction,
  updateKnowledgeAction,
  deleteKnowledgeAction,
  toggleKnowledgeAction,
} from '@/app/admin/knowledge.actions';

/* ─── Types ─────────────────────────────────────────────────────────────── */
export type KBEntry = {
  id: string;
  category: string;
  title: string;
  content: string;
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const PRESET_CATEGORIES = ['Geral', 'Planos', 'Carreira', 'Cashback', 'Processo', 'FAQ'];

/* ─── Category colour map ────────────────────────────────────────────────── */
const CAT_COLORS: Record<string, string> = {
  Geral:     '#38bdf8',
  Planos:    '#a78bfa',
  Carreira:  '#34d399',
  Cashback:  '#fbbf24',
  Processo:  '#f87171',
  FAQ:       '#fb923c',
};
const catColor = (cat: string) => CAT_COLORS[cat] ?? '#94a3b8';

/* ─── Modal ──────────────────────────────────────────────────────────────── */
type ModalMode = { type: 'create' } | { type: 'edit'; entry: KBEntry };

function KBModal({
  mode,
  existingCategories,
  onClose,
}: {
  mode: ModalMode;
  existingCategories: string[];
  onClose: () => void;
}) {
  const isEdit = mode.type === 'edit';
  const entry  = isEdit ? mode.entry : null;

  const action = isEdit ? updateKnowledgeAction : createKnowledgeAction;
  const [state, formAction, pending] = useActionState(action, null);

  // Close on success
  if (state?.ok) { onClose(); }

  const [useCustomCat, setUseCustomCat] = useState(
    isEdit ? !PRESET_CATEGORIES.includes(entry!.category) : false,
  );

  const allCategories = Array.from(
    new Set([...PRESET_CATEGORIES, ...existingCategories]),
  ).sort();

  return (
    <div className="adm-kb-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="adm-kb-modal-panel">

        {/* Head */}
        <div className="adm-modal-head">
          <div>
            <p className="adm-modal-kicker">
              <Brain size={11} style={{ marginRight: 4 }} />
              {isEdit ? 'Editar conhecimento' : 'Novo conhecimento'}
            </p>
            <h2 className="adm-modal-title">
              {isEdit ? entry!.title : 'Adicionar ao Axe'}
            </h2>
          </div>
          <button type="button" className="adm-modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        {/* Form */}
        <form action={formAction} className="adm-modal-form">
          {isEdit && <input type="hidden" name="id" value={entry!.id} />}
          {isEdit && <input type="hidden" name="active" value={entry!.active} />}

          {/* Categoria */}
          <div className="adm-form-field">
            <label className="adm-form-label">
              Categoria
              <button
                type="button"
                onClick={() => setUseCustomCat(!useCustomCat)}
                className="adm-kb-small-link"
              >
                {useCustomCat ? 'Usar existente' : 'Nova categoria'}
              </button>
            </label>

            {useCustomCat ? (
              <input
                name="customCategory"
                type="text"
                className="adm-input"
                placeholder="Nome da nova categoria…"
                defaultValue=""
                required
              />
            ) : (
              <select
                name="category"
                className="adm-form-select"
                defaultValue={entry?.category ?? ''}
                required={!useCustomCat}
              >
                <option value="" disabled>Selecione…</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          {/* Título */}
          <div className="adm-form-field">
            <label className="adm-form-label">Título</label>
            <input
              name="title"
              type="text"
              className="adm-input"
              placeholder="Ex: Prazo de liberação do crédito"
              defaultValue={entry?.title ?? ''}
              required
            />
          </div>

          {/* Conteúdo */}
          <div className="adm-form-field">
            <label className="adm-form-label">
              Conteúdo
              <span className="adm-form-hint">máx. 8.000 caracteres</span>
            </label>
            <textarea
              name="content"
              className="adm-textarea"
              rows={10}
              placeholder="Descreva o conhecimento em detalhes. O Axe usará este texto para responder aos usuários…"
              defaultValue={entry?.content ?? ''}
              required
              maxLength={8000}
            />
          </div>

          {/* Feedback */}
          {state && !state.ok && (
            <p className="adm-form-feedback adm-form-feedback--err">{state.message}</p>
          )}

          {/* Actions */}
          <div className="adm-modal-actions">
            <button type="button" className="adm-btn adm-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="adm-btn adm-btn--primary" disabled={pending}>
              {pending ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar conhecimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ─── Card de entrada ────────────────────────────────────────────────────── */
function KBCard({
  entry,
  existingCategories,
}: {
  entry: KBEntry;
  existingCategories: string[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [, startTransition] = useTransition();

  const toggle = () =>
    startTransition(() => toggleKnowledgeAction(entry.id, entry.active === 1 ? 0 : 1));

  const remove = () => {
    if (!confirm(`Excluir "${entry.title}"?`)) return;
    startTransition(() => deleteKnowledgeAction(entry.id));
  };

  const color = catColor(entry.category);
  const preview = entry.content.length > 140
    ? entry.content.slice(0, 137) + '…'
    : entry.content;

  return (
    <>
      <div className={`adm-kb-card${entry.active ? '' : ' adm-kb-card--inactive'}`}>
        <div className="adm-kb-card-top">
          <span className="adm-kb-badge" style={{ color, borderColor: `${color}30`, background: `${color}12` }}>
            {entry.category}
          </span>
          <span className={`adm-kb-status${entry.active ? ' adm-kb-status--on' : ''}`}>
            {entry.active ? <Check size={11} /> : <X size={11} />}
            {entry.active ? 'Ativo' : 'Inativo'}
          </span>
        </div>

        <h3 className="adm-kb-title">{entry.title}</h3>
        <p className="adm-kb-preview">{preview}</p>

        <div className="adm-kb-actions">
          <button type="button" className="adm-btn-icon" title="Editar" onClick={() => setEditOpen(true)}>
            <Pencil size={13} />
          </button>
          <button type="button" className="adm-btn-icon" title={entry.active ? 'Desativar' : 'Ativar'} onClick={toggle}>
            {entry.active ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button type="button" className="adm-btn-icon adm-btn-icon--danger" title="Excluir" onClick={remove}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {editOpen && (
        <KBModal
          mode={{ type: 'edit', entry }}
          existingCategories={existingCategories}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}

/* ─── Main client component ──────────────────────────────────────────────── */
export function KnowledgeClient({ entries }: { entries: KBEntry[] }) {
  const [modalOpen, setModalOpen]   = useState(false);
  const [activeTab, setActiveTab]   = useState<string>('Todos');

  const categories = Array.from(new Set(entries.map((e) => e.category))).sort();
  const tabs       = ['Todos', ...categories];

  const filtered = activeTab === 'Todos'
    ? entries
    : entries.filter((e) => e.category === activeTab);

  // Group for display
  const grouped = filtered.reduce<Record<string, KBEntry[]>>((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e);
    return acc;
  }, {});

  return (
    <div className="adm-kb-root">

      {/* Toolbar */}
      <div className="adm-kb-toolbar">
        {/* Tabs */}
        <div className="adm-kb-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              className={`adm-kb-tab${activeTab === tab ? ' adm-kb-tab--active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              <span className="adm-kb-tab-count">
                {tab === 'Todos' ? entries.length : entries.filter((e) => e.category === tab).length}
              </span>
            </button>
          ))}
        </div>

        <button type="button" className="adm-btn adm-btn--primary" onClick={() => setModalOpen(true)}>
          <Plus size={15} />
          Novo conhecimento
        </button>
      </div>

      {/* Empty */}
      {entries.length === 0 && (
        <div className="adm-kb-empty">
          <Sparkles size={36} strokeWidth={1.2} />
          <p>Nenhum conhecimento cadastrado ainda.</p>
          <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
            Adicione informações sobre planos, carreira, FAQ e mais para que o Axe responda melhor.
          </p>
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> Adicionar primeiro conhecimento
          </button>
        </div>
      )}

      {/* Groups */}
      {Object.entries(grouped).map(([cat, items]) => (
        <section key={cat} className="adm-kb-section">
          <div className="adm-kb-section-head">
            <span
              className="adm-kb-section-dot"
              style={{ background: catColor(cat) }}
            />
            <h2 className="adm-kb-section-title">{cat}</h2>
            <span className="adm-kb-section-count">{items.length} entrada{items.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="adm-kb-grid">
            {items.map((e) => (
              <KBCard key={e.id} entry={e} existingCategories={categories} />
            ))}
          </div>
        </section>
      ))}

      {/* Modal de criação */}
      {modalOpen && (
        <KBModal
          mode={{ type: 'create' }}
          existingCategories={categories}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
