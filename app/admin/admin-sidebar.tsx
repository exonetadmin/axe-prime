'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ArrowDownToLine,
  Zap,
  FileText,
  BadgeDollarSign,
  Percent,
  Network,
  Settings,
  LogOut,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import type { AdminRole, AdminModule } from '@/src/features/admin/admin.types';
import { ROLE_PERMISSIONS, ROLE_LABELS } from '@/src/features/admin/admin.types';
import { adminLogoutAction } from '@/app/admin/actions';

type NavItem = {
  module: AdminModule;
  label: string;
  href: string;
  icon: LucideIcon;
  group: 'principal' | 'financeiro' | 'sistema';
};

const NAV_ITEMS: NavItem[] = [
  { module: 'dashboard',     label: 'Dashboard',         href: '/admin',              icon: LayoutDashboard, group: 'principal'  },
  { module: 'usuarios',      label: 'Usuários',           href: '/admin/usuarios',     icon: Users,           group: 'principal'  },
  { module: 'rede',          label: 'Rede MLM',           href: '/admin/rede',         icon: Network,         group: 'principal'  },
  { module: 'saques',        label: 'Saques Pendentes',   href: '/admin/saques',       icon: ArrowDownToLine, group: 'financeiro' },
  { module: 'pix',           label: 'Aprovação PIX',      href: '/admin/pix',          icon: Zap,             group: 'financeiro' },
  { module: 'extrato',       label: 'Extrato Empresa',    href: '/admin/extrato',      icon: FileText,        group: 'financeiro' },
  { module: 'comissoes',     label: 'Comissões',          href: '/admin/comissoes',    icon: BadgeDollarSign, group: 'financeiro' },
  { module: 'cashback',      label: 'Cashback',           href: '/admin/cashback',     icon: Percent,         group: 'financeiro' },
  { module: 'planos',        label: 'Planos',             href: '/admin/planos',       icon: CreditCard,      group: 'financeiro' },
  { module: 'configuracoes', label: 'Configurações',      href: '/admin/configuracoes',icon: Settings,        group: 'sistema'    },
];

const GROUP_LABELS: Record<string, string> = {
  principal:  'Principal',
  financeiro: 'Financeiro',
  sistema:    'Sistema',
};

type Props = { role: AdminRole; name: string };

export default function AdminSidebar({ role, name }: Props) {
  const pathname = usePathname();
  const allowed  = ROLE_PERMISSIONS[role];
  const visible  = NAV_ITEMS.filter((item) => allowed.includes(item.module));
  const groups   = ['principal', 'financeiro', 'sistema'] as const;

  return (
    <nav className="adm-sidebar" aria-label="Navegação do painel">

      {/* ── Brand ── */}
      <div className="adm-sidebar-brand">
        <Image
          src="/brand/axe-prime-logotype.png"
          alt="AXE PRIME"
          width={116}
          height={36}
          className="adm-sidebar-logo-img"
          priority
        />
        <span className="adm-sidebar-sub">Admin</span>
      </div>

      {/* ── Nav groups ── */}
      <div className="adm-sidebar-nav">
        {groups.map((group) => {
          const items = visible.filter((i) => i.group === group);
          if (!items.length) return null;

          return (
            <div key={group} className="adm-sidebar-group">
              <p className="adm-sidebar-group-label">{GROUP_LABELS[group]}</p>
              {items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === '/admin'
                    ? pathname === '/admin'
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.module}
                    href={item.href}
                    className={`adm-sidebar-link${isActive ? ' adm-sidebar-link--active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon
                      size={15}
                      strokeWidth={1.8}
                      className="adm-sidebar-link-icon"
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── User strip + logout ── */}
      <div className="adm-sidebar-footer">
        <div className="adm-sidebar-user">
          <div className="adm-sidebar-avatar" aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="adm-sidebar-user-info">
            <p className="adm-sidebar-user-name">{name.split(' ')[0]}</p>
            <p className="adm-sidebar-user-role">{ROLE_LABELS[role]}</p>
          </div>
        </div>

        <form action={adminLogoutAction}>
          <button type="submit" className="adm-sidebar-logout">
            <LogOut size={13} strokeWidth={1.5} />
            <span>Encerrar sessão</span>
          </button>
        </form>
      </div>

    </nav>
  );
}
