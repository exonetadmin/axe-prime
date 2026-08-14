'use client';

/**
 * Admin Rede Tree — Horizontal Card Layout
 *
 * Cada nó = card pill (avatar + nome + nível) com botão "+" adjacente ao avatar.
 * Clicar no "+" revela exatamente quem AQUELE nó convidou, expandindo em linha
 * horizontal abaixo. As linhas SVG de conector mostram de quem cada pessoa veio.
 */

import { useState, useCallback } from 'react';
import Image from 'next/image';
import type { AdminNetworkNode } from '@/src/features/admin/admin.repository';

/* ── Utilitários ─────────────────────────────────────────────── */

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '?';
}

const LEVEL_COLORS: Record<number, string> = {
  1: '#38bdf8', // ciano
  2: '#818cf8', // índigo
  3: '#a78bfa', // violeta
  4: '#f472b6', // rosa
  5: '#f59e0b', // âmbar
};

const PLAN_LABELS: Record<string, string> = {
  start: 'Start', prime: 'Prime', elite: 'Elite',
};

/* ── Ícones inline ────────────────────────────────────────────── */

function PlusIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="5" y1="1" x2="5" y2="9" />
      <line x1="1" y1="5" x2="9" y2="5" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="1" y1="5" x2="9" y2="5" />
    </svg>
  );
}

/* ── Avatar com suporte a foto ───────────────────────────────── */

function NodeAvatar({ name, avatarUrl, active }: { name: string; avatarUrl?: string | null; active: boolean }) {
  const [imgErr, setImgErr] = useState(false);
  const showImg = !!avatarUrl && !imgErr;

  return (
    <div className={`rnt-avatar ${active ? 'rnt-avatar--on' : 'rnt-avatar--off'}`}>
      {showImg ? (
        <Image
          src={avatarUrl!}
          alt={name}
          fill
          sizes="32px"
          className="rnt-avatar-img"
          onError={() => setImgErr(true)}
          unoptimized
        />
      ) : (
        <span className="rnt-avatar-initials">{getInitials(name)}</span>
      )}
      <span className={`rnt-status-dot ${active ? 'rnt-dot--on' : 'rnt-dot--off'}`} aria-hidden />
    </div>
  );
}

/* ── Card de um nó ───────────────────────────────────────────── */

interface NodeCardProps {
  node: AdminNetworkNode;
  isRoot?: boolean;
  defaultExpanded?: boolean;
}

function NodeCard({ node, isRoot = false, defaultExpanded = false }: NodeCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toggle = useCallback(() => setExpanded((v) => !v), []);
  const hasChildren = node.children.length > 0;

  const levelColor = LEVEL_COLORS[node.levelInBase] ?? '#38bdf8';
  const isActive = !!node.adhesion_at;

  return (
    <div className={`rnt-node ${isRoot ? 'rnt-node--root' : ''}`}>

      {/* ── Card pill ── */}
      <div
        className={`rnt-card ${isActive ? 'rnt-card--active' : 'rnt-card--inactive'} ${node.isNewBase ? 'rnt-card--newbase' : ''}`}
        style={{ '--rnt-level-color': levelColor } as React.CSSProperties}
      >
        {/* Avatar com foto de perfil */}
        <NodeAvatar name={node.name} avatarUrl={node.avatar_url} active={isActive} />

        {/* Informações */}
        <div className="rnt-info">
          <span className="rnt-name" title={node.name}>{getFirstName(node.name)}</span>
          <span className="rnt-meta">
            {node.levelInBase > 0 && (
              <span className="rnt-level-chip" style={{ color: levelColor, borderColor: levelColor + '44' }}>
                N{node.levelInBase}
              </span>
            )}
            {node.plan_interest && (
              <span className="rnt-plan-chip">{PLAN_LABELS[node.plan_interest] ?? node.plan_interest}</span>
            )}
            {node.isNewBase && (
              <span
                className="rnt-newbase-chip"
                title="Além do N5 deste usuário — não gera comissão para o usuário raiz, mas gera para os demais da cadeia."
              >
                + base
              </span>
            )}
          </span>
        </div>

        {/* Botão + adjacente ao card (canto direito) */}
        {hasChildren && (
          <button
            type="button"
            className={`rnt-expand-btn ${expanded ? 'rnt-expand-btn--open' : ''}`}
            aria-expanded={expanded}
            aria-label={expanded ? `Recolher filhos de ${getFirstName(node.name)}` : `Expandir filhos de ${getFirstName(node.name)}`}
            onClick={toggle}
            title={`${node.children.length} indicação${node.children.length !== 1 ? 'ões' : ''}`}
          >
            {expanded ? <MinusIcon /> : <PlusIcon />}
            <span className="rnt-expand-count">{node.children.length}</span>
          </button>
        )}
      </div>

      {/* ── Filhos em linha horizontal ── */}
      {hasChildren && expanded && (
        <div className="rnt-branch">
          <div className="rnt-children">
            {node.children.map((child) => (
              <NodeCard key={child.id} node={child} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Componente público ──────────────────────────────────────── */

interface AdminRedeTreeProps {
  roots: AdminNetworkNode[];
}

export function AdminRedeTree({ roots }: AdminRedeTreeProps) {
  if (roots.length === 0) {
    return (
      <div className="rnt-empty">
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Nenhum nó encontrado na rede.</span>
      </div>
    );
  }

  return (
    <div className="rnt-map">
      {roots.length === 1 ? (
        /* Raiz única: colapsada — clique no "+" para expandir */
        <NodeCard node={roots[0]} isRoot />
      ) : (
        /* Múltiplas raízes: mostrar horizontalmente, mas independentes (sem conectores interligados) */
        <div className="rnt-roots">
          {roots.map((root) => (
            <NodeCard key={root.id} node={root} isRoot />
          ))}
        </div>
      )}
    </div>
  );
}
