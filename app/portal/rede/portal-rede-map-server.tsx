import type { NetworkTreeNode } from '@/src/features/network';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase();
}

function NetworkBranch({ node, root = false }: { node: NetworkTreeNode; root?: boolean }) {
  const state = node.active ? 'is-active' : 'is-inactive';
  return (
    <div className="portal-rede-map-branch">
      {root && <span className="portal-rede-map-you">Você</span>}
      <div className="portal-rede-map-node">
        <div className="portal-rede-map-node-cell">
          <article className={`portal-rede-map-card ${root ? 'is-root' : ''} ${state}`}>
            <div className="portal-rede-map-card-head">
              <span className={`portal-rede-map-circle ${state}`} aria-hidden>
                <span className="portal-rede-map-circle-core">
                  {initials(node.displayName)}
                </span>
              </span>
              <div className="portal-rede-map-card-copy">
                <div className="portal-rede-map-card-top">
                  <span className="portal-rede-map-level">
                    {root ? 'Origem' : `Nível ${node.levelInBase || node.level}`}
                  </span>
                  <span className={`portal-rede-map-status ${state}`}>
                    <span className="portal-rede-map-status-dot" aria-hidden />
                    {node.active ? 'Ativo' : 'Em atraso'}
                  </span>
                </div>
                <h3 className="portal-rede-map-name">{node.displayName}</h3>
                {node.isNewBase && (
                  <span className="portal-rede-map-branch-note">
                    Início de uma nova base
                  </span>
                )}
              </div>
            </div>
          </article>
        </div>

        {node.children.length > 0 && (
          <>
            <span className="portal-rede-map-connector-v" aria-hidden />
            <span className="portal-rede-map-connector-h" aria-hidden />
            <div className="portal-rede-map-children">
              {node.children.map((child) => (
                <div className="portal-rede-map-child-branch" key={child.id}>
                  <span className="portal-rede-map-connector-v-down" aria-hidden />
                  <NetworkBranch node={child} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function PortalRedeMapServer({ node }: { node: NetworkTreeNode }) {
  return (
    <div className="portal-rede-map">
      <NetworkBranch node={node} root />
    </div>
  );
}
