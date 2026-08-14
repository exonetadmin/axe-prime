import { configRepository } from '@/src/features/admin/config.repository';
import { KnowledgeClient, type KBEntry } from '@/app/admin/_components/knowledge-client';
import { Brain, BookOpen, CheckCircle2, FolderOpen } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ConhecimentoPage() {
  const rawEntries = await configRepository.listKnowledge();
  const entries = rawEntries.map((e) => ({ ...e, active: e.active ? 1 : 0 })) as KBEntry[];

  const total      = entries.length;
  const ativos     = entries.filter((e) => e.active === 1).length;
  const categorias = new Set(entries.map((e) => e.category)).size;

  return (
    <div className="adm-page">
      {/* Header */}
      <header className="adm-page-header">
        <div>
          <div className="adm-kb-page-icon">
            <Brain size={22} />
          </div>
          <div>
            <h1 className="adm-page-title">Base de Conhecimento</h1>
            <p className="adm-page-subtitle">
              Tudo que está ativo aqui é lido pelo Axe antes de cada resposta.
            </p>
          </div>
        </div>
      </header>

      {/* Stats strip */}
      <div className="adm-kb-stats">
        <div className="adm-kb-stat">
          <span className="adm-kb-stat-icon" style={{ color: '#a78bfa' }}>
            <BookOpen size={16} />
          </span>
          <div>
            <p className="adm-kb-stat-value">{total}</p>
            <p className="adm-kb-stat-label">Total de entradas</p>
          </div>
        </div>
        <div className="adm-kb-stat">
          <span className="adm-kb-stat-icon" style={{ color: '#34d399' }}>
            <CheckCircle2 size={16} />
          </span>
          <div>
            <p className="adm-kb-stat-value">{ativos}</p>
            <p className="adm-kb-stat-label">Ativas</p>
          </div>
        </div>
        <div className="adm-kb-stat">
          <span className="adm-kb-stat-icon" style={{ color: '#38bdf8' }}>
            <FolderOpen size={16} />
          </span>
          <div>
            <p className="adm-kb-stat-value">{categorias}</p>
            <p className="adm-kb-stat-label">Categorias</p>
          </div>
        </div>
      </div>

      {/* Interactive list */}
      <KnowledgeClient entries={entries} />
    </div>
  );
}
