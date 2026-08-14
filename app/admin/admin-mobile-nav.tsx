'use client';

/**
 * AdminMobileNav — Topbar + Drawer para mobile (≤768 px)
 * Oculto em desktop via CSS (adm-mobile-nav { display: none } @media >768px).
 */

import { useState, useCallback, useEffect } from 'react';
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
  Menu,
  X,
  Brain,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import type { AdminRole, AdminModule } from '@/src/features/admin/admin.types';
import { ROLE_PERMISSIONS, ROLE_LABELS } from '@/src/features/admin/admin.types';
import { adminLogoutAction } from '@/app/admin/actions';

/* ── Nav items (espelha admin-sidebar.tsx) ────────────────────── */

type NavItem = {
  module: AdminModule;
  label: string;
  href: string;
  icon: LucideIcon;
  group: 'principal' | 'financeiro' | 'sistema';
};

const NAV_ITEMS: NavItem[] = [
  { module: 'dashboard',     label: 'Dashboard',         href: '/admin',               icon: LayoutDashboard, group: 'principal'  },
  { module: 'usuarios',      label: 'Usuários',           href: '/admin/usuarios',      icon: Users,           group: 'principal'  },
  { module: 'rede',          label: 'Rede MLM',           href: '/admin/rede',          icon: Network,         group: 'principal'  },
  { module: 'saques',        label: 'Saques Pendentes',   href: '/admin/saques',        icon: ArrowDownToLine, group: 'financeiro' },
  { module: 'pix',           label: 'Aprovação PIX',      href: '/admin/pix',           icon: Zap,             group: 'financeiro' },
  { module: 'extrato',       label: 'Extrato Empresa',    href: '/admin/extrato',       icon: FileText,        group: 'financeiro' },
  { module: 'comissoes',     label: 'Comissões',          href: '/admin/comissoes',     icon: BadgeDollarSign, group: 'financeiro' },
  { module: 'cashback',      label: 'Cashback',           href: '/admin/cashback',      icon: Percent,         group: 'financeiro' },
  { module: 'planos',        label: 'Planos',             href: '/admin/planos',        icon: CreditCard,      group: 'financeiro' },
  { module: 'configuracoes', label: 'Configurações',      href: '/admin/configuracoes', icon: Settings,        group: 'sistema'    },
  { module: 'conhecimento',  label: 'Axe IA',              href: '/admin/conhecimento',  icon: Brain,           group: 'sistema'    },
];

const GROUP_LABELS: Record<string, string> = {
  principal:  'Principal',
  financeiro: 'Financeiro',
  sistema:    'Sistema',
};

/* ── Componente ───────────────────────────────────────────────── */

type Props = { role: AdminRole; name: string };

export default function AdminMobileNav({ role, name }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  // Fecha o drawer ao navegar
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { close(); }, [pathname, close]);

  // Fecha ao pressionar Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  // Bloqueia scroll do body quando drawer aberto
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const allowed = ROLE_PERMISSIONS[role];
  const visible  = NAV_ITEMS.filter((item) => allowed.includes(item.module));
  const groups   = ['principal', 'financeiro', 'sistema'] as const;

  // Título da página atual para o topbar
  const currentPage = NAV_ITEMS.find((item) =>
    item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
  );

  return (
    <>
      {/* ── Topbar fixa ── */}
      <header className="adm-mobile-topbar">
        <div className="adm-mobile-topbar-inner">
          {/* Brand */}
          <div className="adm-mobile-brand">
            <Image
              src="/brand/axe-prime-logotype.png"
              alt="AXE PRIME"
              width={90}
              height={28}
              className="adm-sidebar-logo-img"
              priority
            />
            <span className="adm-sidebar-sub">Admin</span>
          </div>

          {/* Título da página atual */}
          {currentPage && (
            <span className="adm-mobile-page-title">{currentPage.label}</span>
          )}

          {/* Hamburger */}
          <button
            type="button"
            className="adm-mobile-menu-btn"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} strokeWidth={1.8} /> : <Menu size={20} strokeWidth={1.8} />}
          </button>
        </div>
      </header>

      {/* ── Overlay ── */}
      {open && (
        <div
          className="adm-drawer-overlay"
          aria-hidden
          onClick={close}
        />
      )}

      {/* ── Drawer lateral ── */}
      <nav
        className={`adm-drawer ${open ? 'adm-drawer--open' : ''}`}
        aria-label="Menu de navegação mobile"
      >
        {/* Header do drawer */}
        <div className="adm-drawer-header">
          <div className="adm-sidebar-user">
            <div className="adm-sidebar-avatar" aria-hidden="true">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="adm-sidebar-user-info">
              <p className="adm-sidebar-user-name">{name.split(' ')[0]}</p>
              <p className="adm-sidebar-user-role">{ROLE_LABELS[role]}</p>
            </div>
          </div>
          <button
            type="button"
            className="adm-drawer-close"
            aria-label="Fechar menu"
            onClick={close}
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        {/* Nav grupos */}
        <div className="adm-drawer-nav">
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
                      className={`adm-drawer-link${isActive ? ' adm-drawer-link--active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon size={16} strokeWidth={1.8} className="adm-sidebar-link-icon" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="adm-drawer-footer">
          <form action={adminLogoutAction}>
            <button type="submit" className="adm-sidebar-logout">
              <LogOut size={13} strokeWidth={1.5} />
              <span>Encerrar sessão</span>
            </button>
          </form>
        </div>
      </nav>
    </>
  );
}
