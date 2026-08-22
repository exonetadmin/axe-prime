'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Link2,
  Coins,
  Wallet,
  CreditCard,
  User,
  Award,
  Menu,
  X,
  Star,
  Trophy,
} from 'lucide-react';

import LogoutButton from '@/components/logout-button';

/* ── 4 primary items shown in the floating bar ── */
const primaryNav = [
  { href: '/portal', label: 'Início', icon: LayoutDashboard },
  { href: '/portal/indicar', label: 'Indicar', icon: Link2 },
  { href: '/portal/comissoes', label: 'Comissões', icon: Coins },
  { href: '/portal/cashback', label: 'Cashback', icon: Wallet },
  { href: '/portal/carteira', label: 'Carteira', icon: CreditCard },
];

/* ── Secondary items inside the hamburger drawer ── */
const secondaryNav = [
  { href: '/portal/planos', label: 'Planos', icon: Star },
  { href: '/portal/premios', label: 'Prêmios', icon: Trophy },
  { href: '/portal/rede', label: 'Minha Equipe', icon: Users },
  { href: '/portal/carreira', label: 'Carreira', icon: Award },
  { href: '/portal/perfil', label: 'Perfil', icon: User },
];

/* ── Full list for the desktop sidebar (unchanged) ── */
const allNav = [...primaryNav, ...secondaryNav];

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => setMenuOpen(o => !o), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu, menuOpen]);

  const isLinkActive = (href: string) =>
    href === '/portal' ? pathname === '/portal' : pathname.startsWith(href);

  return (
    <div className="portal-layout">
      {/* ── Desktop sidebar ── */}
      <aside className="portal-nav-shell">
        <nav className="portal-nav" aria-label="Área do membro">
          {allNav.map(({ href, label, icon: Icon }) => {
            const isActive = isLinkActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`portal-nav-link${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ── Content wrapper: header + main (flex column, takes all remaining space) ── */}
      <div className="portal-content-wrapper">
        <header className="portal-header">
          <Link href="/" className="brand">
            <Image
              src="/brand/axe-prime-logotype.png"
              alt="AXE PRIME"
              width={172}
              height={54}
              className="brand-logo"
              priority
            />
          </Link>
          <div className="header-actions">
            <LogoutButton />
          </div>
        </header>

        <main className="portal-main">{children}</main>
      </div>

      {/* ── Mobile floating bottom bar ── */}
      <nav className="portal-nav-mobile" aria-label="Navegação móvel">
        {primaryNav.map(({ href, label, icon: Icon }) => {
          const isActive = isLinkActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`portal-nav-link${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={closeMenu}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}

        {/* Hamburger toggle */}
        <button
          type="button"
          className={`portal-nav-link portal-nav-hamburger${menuOpen ? ' is-open' : ''}`}
          onClick={toggleMenu}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {menuOpen ? (
            <X size={18} strokeWidth={1.8} aria-hidden />
          ) : (
            <Menu size={18} strokeWidth={1.8} aria-hidden />
          )}
          <span>Mais</span>
        </button>
      </nav>

      {/* ── Hamburger drawer ── */}
      {menuOpen && (
        <>
          <div className="portal-drawer-backdrop" onClick={closeMenu} aria-hidden="true" />
          <aside
            className="portal-drawer is-open"
            role="dialog"
            aria-modal="true"
            aria-label="Menu adicional"
          >
            <div className="portal-drawer-header">
              <span className="portal-drawer-title">Menu</span>
              <button
                type="button"
                className="portal-drawer-close"
                onClick={closeMenu}
                aria-label="Fechar menu"
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </div>
            <nav className="portal-drawer-nav" aria-label="Menu adicional">
              {secondaryNav.map(({ href, label, icon: Icon }) => {
                const isActive = isLinkActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`portal-drawer-link${isActive ? ' is-active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={closeMenu}
                  >
                    <Icon size={20} strokeWidth={1.8} aria-hidden />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="portal-drawer-session">
              <LogoutButton />
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
