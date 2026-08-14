'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowRight } from 'lucide-react';
import { navItems } from '@/lib/site-content';

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const [activeHref, setActiveHref] = useState('');
  const pathname = usePathname();
  const isRoot = pathname === '/';

  useEffect(() => {
    const sections = navItems
      .filter(item => item.kind === 'section')
      .map(item => document.querySelector(item.href) as HTMLElement | null);

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHref(`#${entry.target.id}`);
          }
        }
      },
      { threshold: 0.35 }
    );

    sections.forEach(el => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        className="hamburger-btn"
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={open}
      >
        {open ? <X size={22} strokeWidth={1.8} /> : <Menu size={22} strokeWidth={1.8} />}
      </button>

      {open && (
        <div className="mobile-drawer" onClick={() => setOpen(false)}>
          <div className="mobile-drawer-panel" onClick={e => e.stopPropagation()}>
            <nav className="mobile-drawer-nav" aria-label="Menu de navegação">
              {navItems.map(item =>
                item.kind === 'section' ? (
                  <a
                    key={item.href}
                    href={isRoot ? item.href : `/${item.href}`}
                    className={`mobile-nav-link${activeHref === item.href ? ' is-active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="mobile-nav-link"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </Link>
                )
              )}
            </nav>
            <div className="mobile-drawer-cta">
              <Link
                href="/auth?mode=register"
                className="primary-button"
                onClick={() => setOpen(false)}
              >
                Entrar para a estrutura
                <ArrowRight size={16} strokeWidth={1.8} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
