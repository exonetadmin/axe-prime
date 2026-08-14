import { getAuthenticatedUser } from '@/lib/auth';
import { PerfilForm } from './perfil-form';

export const dynamic = 'force-dynamic';

function formatPlan(plan: string | null): string {
  if (!plan) return 'Não informado';
  return (
    { start: 'Start', prime: 'Prime', elite: 'Elite' }[plan] ?? plan
  );
}

export default async function PortalPerfilPage() {
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (err) {
    console.error('[PortalPerfilPage] auth error:', err);
    return (
      <div className="portal-page">
        <section className="portal-shell">
          <p style={{ color: '#f87171', padding: '2rem', textAlign: 'center' }}>
            Erro ao carregar dados do usuário. Faça login novamente.
          </p>
        </section>
      </div>
    );
  }

  if (!user) return null;

  let joinedAt = '—';
  try {
    if (user.createdAt) {
      joinedAt = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'long',
      }).format(new Date(user.createdAt));
    }
  } catch {
    joinedAt = String(user.createdAt ?? '—');
  }

  return (
    <div className="portal-page">
      <section className="portal-shell">
        {/* ── Header ── */}
        <div className="portal-welcome-banner pf-page-header">
          <h1 className="portal-title">Perfil</h1>
          <p className="portal-welcome-copy">
            Seus dados pessoais e configurações de conta.
          </p>
        </div>

        {/* ── Premium Profile Card ── */}
        <article className="pf-card">
          <PerfilForm
            initialName={user.name ?? ''}
            initialEmail={user.email ?? ''}
            initialPhone={user.phone ?? null}
            initialAvatarUrl={user.avatarUrl ?? null}
            initialCpf={user.cpf ?? null}
            planLabel={formatPlan(user.planInterest ?? null)}
            joinedAt={joinedAt}
            referralCode={user.referralCode ?? ''}
          />
        </article>
      </section>
    </div>
  );
}
