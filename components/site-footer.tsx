import Link from 'next/link';
import {
  Phone,
  Mail,
  MapPin,
  Instagram,
  ArrowUpRight,
} from 'lucide-react';

/* ── Navegação principal ──────────────────────────────────────── */
const NAV_LINKS = [
  { label: 'Nossa História',    href: '/#manifesto' },
  { label: 'Benefícios',        href: '/#beneficios' },
  { label: 'Simulador',          href: '/simulador' },
  { label: 'Plano de Carreira', href: '/#carreira' },
];

/* ── Contatos ─────────────────────────────────────────────────── */
const CONTACTS = [
  {
    icon: Phone,
    label: '+55 (61) 98649-1241',
    href: 'tel:+5561986491241',
    sub: null,
  },
  {
    icon: Mail,
    label: 'contato@axeprime.com.br',
    href: 'mailto:contato@axeprime.com.br',
    sub: null,
  },
  {
    icon: MapPin,
    label: 'Brasília, DF',
    href: null,
    sub: 'Brasil',
  },
  {
    icon: Instagram,
    label: '@axeprime_br',
    href: 'https://instagram.com/axeprime_br',
    sub: null,
  },
];

/* ═══════════════════════════════════════════════════════════════ */
export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer-main">
      {/* Linha divisória topo com glow cyan */}
      <div className="sft-topline" aria-hidden />

      <div className="sft-inner">

        {/* ── Coluna 1: Logo + Tagline ────────────────────────── */}
        <div className="sft-brand">
          <Link href="/" className="sft-logo" aria-label="AXE PRIME — página inicial">
            <span className="sft-logo-axe">AXE</span>
            <span className="sft-logo-sep" aria-hidden>|</span>
            <span className="sft-logo-prime">PRIME</span>
          </Link>

          <p className="sft-tagline">
            Estrutura de inteligência financeira para quem decide crescer com consistência e clareza.
          </p>

        </div>

        {/* ── Coluna 2: Navegação ─────────────────────────────── */}
        <nav className="sft-nav" aria-label="Navegação do rodapé">
          <p className="sft-col-title">Navegação</p>
          <ul role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="sft-nav-link"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Coluna 3: Contato ───────────────────────────────── */}
        <div className="sft-contacts" aria-label="Informações de contato">
          <p className="sft-col-title">Contato</p>
          <ul role="list">
            {CONTACTS.map((c) => {
              const Icon = c.icon;
              const inner = (
                <>
                  <span className="sft-contact-icon" aria-hidden>
                    <Icon size={14} strokeWidth={1.8} />
                  </span>
                  <span className="sft-contact-text">
                    <span className="sft-contact-label">{c.label}</span>
                    {c.sub && (
                      <span className="sft-contact-sub">{c.sub}</span>
                    )}
                  </span>
                  {c.href && !c.href.startsWith('tel') && !c.href.startsWith('mailto') && (
                    <ArrowUpRight size={11} strokeWidth={2} className="sft-contact-arrow" aria-hidden />
                  )}
                </>
              );

              return (
                <li key={c.label}>
                  {c.href ? (
                    <a
                      href={c.href}
                      className="sft-contact-item"
                      {...(c.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="sft-contact-item sft-contact-item--static">
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ── Barra legal ─────────────────────────────────────── */}
      <div className="sft-legal">
        <p className="sft-legal-copy">
          © {year} AXE PRIME. Todos os direitos reservados.
        </p>
        <div className="sft-legal-links">
          <Link href="/privacidade" className="sft-legal-link">Privacidade</Link>
          <span aria-hidden className="sft-legal-sep">·</span>
          <Link href="/termos" className="sft-legal-link">Termos de uso</Link>
        </div>
      </div>
    </footer>
  );
}
