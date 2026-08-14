import { redirect } from 'next/navigation';
import { getAdminSession } from '@/src/features/admin/admin.auth';
import AdminLoginForm from './admin-login-form';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) redirect('/admin');

  return (
    <main className="adm-login-page">
      <div className="adm-login-shell">

        {/* ── Left: Brand Strip ── */}
        <aside className="adm-login-brand">
          <div>
            <Image
              src="/brand/axe-prime-logotype.png"
              alt="AXE PRIME"
              width={148}
              height={46}
              priority
              className="adm-login-brand-logo"
            />
            <p className="adm-login-brand-tag">Painel Administrativo</p>
            <h1 className="adm-login-brand-title">
              Torre de<br />Controle
            </h1>
            <p className="adm-login-brand-sub">
              Acesso restrito à equipe interna AXE PRIME.
              Todas as ações são monitoradas e auditadas.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.7rem',
              color: 'var(--text-soft)',
            }}>
              <ShieldCheck size={13} strokeWidth={1.5} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              Sessão monitorada e criptografada
            </div>
            <span className="adm-login-brand-badge">⬡ Sistema Interno v2</span>
          </div>
        </aside>

        {/* ── Right: Form ── */}
        <section className="adm-login-card">
          <header>
            <h2 className="adm-login-card-title">Autenticação</h2>
            <p className="adm-login-card-sub">
              Use suas credenciais corporativas para acessar o painel.
            </p>
          </header>

          <AdminLoginForm />

          <p className="adm-login-disclaimer">
            Ao acessar, você confirma estar autorizado e aceita as
            políticas de uso interno da AXE PRIME.
          </p>
        </section>

      </div>
    </main>
  );
}
