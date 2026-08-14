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
  { label: 'Copiloto IA',       href: '/copiloto', highlight: true },
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
export default function CopilotoFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="cop-footer">
      {/* Linha divisória topo com glow cyan */}
      <div className="cop-footer-topline" aria-hidden />

      <div className="cop-footer-inner">

        {/* ── Coluna 1: Logo + Tagline ────────────────────────── */}
        <div className="cop-footer-brand">
          {/* Logo AXE PRIME em texto estilizado */}
          <Link href="/" className="cop-footer-logo" aria-label="AXE PRIME — página inicial">
            <span className="cop-footer-logo-axe">AXE</span>
            <span className="cop-footer-logo-sep" aria-hidden>|</span>
            <span className="cop-footer-logo-prime">PRIME</span>
          </Link>

          <p className="cop-footer-tagline">
            Estrutura de inteligência financeira para quem decide crescer com consistência e clareza.
          </p>

          {/* Lacre de IA */}
          <div className="cop-footer-ai-badge" aria-label="Powered by IA">
            <span className="cop-footer-ai-dot" aria-hidden />
            Copiloto IA Ativo
          </div>
        </div>

        {/* ── Coluna 2: Navegação ─────────────────────────────── */}
        <nav className="cop-footer-nav" aria-label="Navegação do rodapé">
          <p className="cop-footer-col-title">Navegação</p>
          <ul role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`cop-footer-nav-link${link.highlight ? ' cop-footer-nav-link--hl' : ''}`}
                >
                  {link.highlight && (
                    <span className="cop-footer-nav-dot" aria-hidden />
                  )}
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Coluna 3: Contato ───────────────────────────────── */}
        <div className="cop-footer-contacts" aria-label="Informações de contato">
          <p className="cop-footer-col-title">Contato</p>
          <ul role="list">
            {CONTACTS.map((c) => {
              const Icon = c.icon;
              const inner = (
                <>
                  <span className="cop-footer-contact-icon" aria-hidden>
                    <Icon size={14} strokeWidth={1.8} />
                  </span>
                  <span className="cop-footer-contact-text">
                    <span className="cop-footer-contact-label">{c.label}</span>
                    {c.sub && (
                      <span className="cop-footer-contact-sub">{c.sub}</span>
                    )}
                  </span>
                  {c.href && !c.href.startsWith('tel') && !c.href.startsWith('mailto') && (
                    <ArrowUpRight size={11} strokeWidth={2} className="cop-footer-contact-arrow" aria-hidden />
                  )}
                </>
              );

              return (
                <li key={c.label}>
                  {c.href ? (
                    <a
                      href={c.href}
                      className="cop-footer-contact-item"
                      {...(c.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="cop-footer-contact-item cop-footer-contact-item--static">
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* ── Barra de rodapé legal ────────────────────────────── */}
      <div className="cop-footer-legal">
        <p className="cop-footer-legal-copy">
          © {year} AXE PRIME. Todos os direitos reservados.
        </p>
        <div className="cop-footer-legal-links">
          <Link href="/privacidade" className="cop-footer-legal-link">Privacidade</Link>
          <span aria-hidden className="cop-footer-legal-sep">·</span>
          <Link href="/termos" className="cop-footer-legal-link">Termos de uso</Link>
        </div>
      </div>
    </footer>
  );
}
