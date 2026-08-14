'use client';

import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useActiveSection } from '@/hooks/use-active-section';
import { navItems } from '@/lib/site-content';

const MobileNav = dynamic(() => import('@/components/mobile-nav'), {
  ssr: false,
});

const sectionIds = navItems
  .filter(item => item.kind === 'section')
  .map(item => item.href.replace('#', ''));

export default function Header() {
  const pathname = usePathname();
  const isRoot = pathname === '/';
  const activeSection = useActiveSection(sectionIds, 120);

  return (
    <header className="site-header shell-panel">
      <Link href="/" className="brand" aria-label="AXE PRIME">
        <Image
          src="/brand/axe-prime-logotype.png"
          alt="AXE PRIME"
          width={180}
          height={56}
          className="brand-logo"
          priority
        />
      </Link>

      <nav className="site-nav desktop-nav" aria-label="Categorias da jornada">
        {navItems.map(item => {
          const isSectionItem = item.kind === 'section';
          const id = isSectionItem ? item.href.replace('#', '') : '';
          const isActive = isSectionItem && isRoot && activeSection === id;

          if (isSectionItem) {
            /* Fora da raiz (ex: /copiloto), href relativo "#section" vira
               "/copiloto#section". Prefixar com "/" garante "/#section". */
            const href = isRoot ? item.href : `/${item.href}`;
            return (
              <a key={item.href} href={href} className={isActive ? 'is-active' : ''}>
                {item.label}
              </a>
            );
          }

          return (
            <Link key={item.href} href={item.href} className="site-nav-route">
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="header-actions desktop-nav">
        <Link href="/auth" className="secondary-button">
          Entrar
        </Link>
      </div>

      <MobileNav />
    </header>
  );
}
