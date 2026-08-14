import { getAdminSession } from '@/src/features/admin/admin.auth';
import { canAccess, type AdminModule } from '@/src/features/admin/admin.types';
import { ShieldOff } from 'lucide-react';

type Props = {
  module: AdminModule;
  title: string;
  description?: string;
  children?: React.ReactNode;
};

/**
 * Wraps any admin module page.
 * - Reads the session (guaranteed to exist by the parent layout).
 * - If the user's role doesn't have access → shows "Sem permissão".
 * - Otherwise renders children (or a "coming soon" card if children is null).
 */
export default async function AdminModuleGate({
  module,
  title,
  description,
  children,
}: Props) {
  const session = (await getAdminSession())!;

  if (!canAccess(session.role, module)) {
    return (
      <div className="adm-page">
        <div className="adm-forbidden">
          <ShieldOff size={40} strokeWidth={1.5} className="adm-forbidden-icon" />
          <h1 className="adm-forbidden-title">Acesso não autorizado</h1>
          <p className="adm-forbidden-sub">
            O cargo <strong>{session.role}</strong> não tem permissão para
            acessar o módulo <strong>{title}</strong>.
          </p>
          <p className="adm-forbidden-hint">
            Solicite ao Master Admin se precisar de acesso.
          </p>
        </div>
      </div>
    );
  }

  if (children) return <>{children}</>;

  // Default "em construção" card
  return (
    <div className="adm-page">
      <header className="adm-page-header">
        <div>
          <p className="adm-page-kicker">Módulo</p>
          <h1 className="adm-page-title">{title}</h1>
          {description && <p className="adm-page-sub">{description}</p>}
        </div>
      </header>
      <div className="adm-coming-soon">
        <span className="adm-coming-soon-icon">🚧</span>
        <p className="adm-coming-soon-title">Módulo em construção</p>
        <p className="adm-coming-soon-sub">
          Este módulo está em desenvolvimento. Em breve estará disponível.
        </p>
      </div>
    </div>
  );
}
