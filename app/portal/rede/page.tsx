import { getAuthenticatedUser } from '@/lib/auth';
import { networkService } from '@/src/features/network';
import type { NetworkTreeNode } from '@/src/features/network';
import { portalScreenCopy } from '@/lib/access-copy';
import { PortalRedeMapServer } from './portal-rede-map-server';

export const dynamic = 'force-dynamic';

function formatPlan(plan: string | null): string {
  if (!plan) return '—';
  return (
    { start: 'Start', prime: 'Prime', elite: 'Carreira de Elite' }[plan] ?? plan
  );
}

/** Garante árvore serializável para o client. */
function serializableTree(node: NetworkTreeNode): NetworkTreeNode {
  return {
    id: String(node.id),
    displayName: String(node.displayName ?? '—'),
    active: Boolean(node.active),
    level: Number(node.level),
    children: (node.children ?? []).map(serializableTree),
  };
}

function summarizeTree(node: NetworkTreeNode) {
  let mappedPeople = 0;
  let activePeople = 0;
  let inactivePeople = 0;
  let deepestLevel = Number(node.level ?? 0);

  function walk(current: NetworkTreeNode, isRoot: boolean) {
    deepestLevel = Math.max(deepestLevel, Number(current.level ?? 0));

    if (!isRoot) {
      mappedPeople += 1;
      if (current.active) {
        activePeople += 1;
      } else {
        inactivePeople += 1;
      }
    }

    for (const child of current.children ?? []) {
      walk(child, false);
    }
  }

  walk(node, true);

  return {
    mappedPeople,
    activePeople,
    inactivePeople,
    layersRead: deepestLevel + 1,
  };
}

export default async function PortalRedePage() {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const [directReferrals, tree] = await Promise.all([
    networkService.getDirectReferrals(user.id),
    networkService.getNetworkTree(user.id, 5),
  ]);
  const treeForClient = serializableTree(tree);
  const treeSummary = summarizeTree(treeForClient);

  return (
    <div className="portal-page">
      <section className="portal-shell">
        <div className="portal-welcome-banner">
          <h1 className="portal-title">
            {portalScreenCopy.network?.title ?? 'Minha rede'}
          </h1>
          <p className="portal-welcome-copy">
            {portalScreenCopy.network?.body ??
              'Leitura visual da sua estrutura por camadas, com foco em atividade e expansão da rede.'}
          </p>
        </div>

        <article className="portal-card portal-card-rede-map">
          <div className="portal-rede-map-header">
            <div className="portal-rede-map-copy">
              <span className="portal-kicker">Mapa da rede</span>
              <h2 className="portal-rede-map-title">Leitura da sua estrutura por camadas</h2>
              <p className="metric-label portal-rede-map-intro">
                A visualização organiza origem, atividade e ramificações da sua rede
                em uma leitura mais clara da estrutura atual.
              </p>
            </div>

            <div className="portal-rede-map-legend" aria-label="Legenda do mapa">
              <span className="portal-rede-map-legend-item is-active">
                <span className="portal-rede-map-legend-dot" aria-hidden />
                Ativo
              </span>
              <span className="portal-rede-map-legend-item is-inactive">
                <span className="portal-rede-map-legend-dot" aria-hidden />
                Em atraso
              </span>
            </div>
          </div>

          <div className="portal-rede-map-stats" aria-label="Resumo da rede">
            <div className="portal-rede-map-stat">
              <span className="portal-rede-map-stat-label">Pessoas mapeadas</span>
              <strong className="portal-rede-map-stat-value">{treeSummary.mappedPeople}</strong>
            </div>
            <div className="portal-rede-map-stat">
              <span className="portal-rede-map-stat-label">Ativas</span>
              <strong className="portal-rede-map-stat-value">{treeSummary.activePeople}</strong>
            </div>
            <div className="portal-rede-map-stat">
              <span className="portal-rede-map-stat-label">Em atraso</span>
              <strong className="portal-rede-map-stat-value">{treeSummary.inactivePeople}</strong>
            </div>
            <div className="portal-rede-map-stat">
              <span className="portal-rede-map-stat-label">Camadas lidas</span>
              <strong className="portal-rede-map-stat-value">{treeSummary.layersRead}</strong>
            </div>
          </div>

          <div className="portal-rede-tree-root">
            <PortalRedeMapServer node={treeForClient} />
          </div>
        </article>

        <article className="portal-card">
          <span className="portal-kicker">Indicados diretos</span>
          <p className="metric-label">
            Total: {directReferrals.length} pessoa(s)
          </p>
          {directReferrals.length === 0 ? (
            <p className="metric-note">
              Ninguém entrou na sua rede ainda. Use seu link de indicação na aba
              &quot;Indicar&quot;.
            </p>
          ) : (
            <ul className="portal-rede-list">
              {directReferrals.map((member) => (
                <li key={member.id} className="portal-rede-item">
                  <span className="portal-rede-name">{member.name}</span>
                  <span
                    className={`portal-rede-status ${member.active ? 'is-active' : 'is-inactive'}`}
                    aria-label={member.active ? 'Ativo' : 'Inativo'}
                  >
                    {member.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <span className="portal-rede-meta">
                    {member.email} · {formatPlan(member.planInterest)} · entrou em{' '}
                    {new Intl.DateTimeFormat('pt-BR', {
                      dateStyle: 'short',
                    }).format(new Date(member.createdAt))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
