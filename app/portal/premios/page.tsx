import Image from 'next/image';
import {
  Smartphone,
  Watch,
  PlaneTakeoff,
  Car,
  Gauge,
  Trophy,
  Users,
  TrendingUp,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

/* ── Types ──────────────────────────────────────────────────── */
type Premio = {
  key: string;
  rank: number;
  nivel: string;
  faturamento: string;
  faturamentoShort: string;
  cargoQtd: string;
  cargoNome: string;
  premio: string;
  img: string;
  featured?: boolean;
};

/* ── Icon map (Lucide — NO emojis) ──────────────────────────── */
const ICONS: Record<string, React.FC<{ size?: number; strokeWidth?: number; className?: string }>> = {
  iphone: Smartphone,
  rolex: Watch,
  dubai: PlaneTakeoff,
  bmw: Car,
  porsche: Gauge,
  ferrari: Trophy,
};

/* ── Data ────────────────────────────────────────────────────── */
const PREMIOS: Premio[] = [
  {
    key: 'iphone',
    rank: 1,
    nivel: 'Nível 1',
    faturamento: 'R$ 300 mil',
    faturamentoShort: '300K',
    cargoQtd: '3',
    cargoNome: 'Gerentes Sênior',
    premio: 'iPhone 17 Pro Max',
    img: '/images/premios/iphone-17-orange.png',
  },
  {
    key: 'rolex',
    rank: 2,
    nivel: 'Nível 2',
    faturamento: 'R$ 900 mil',
    faturamentoShort: '900K',
    cargoQtd: '3',
    cargoNome: 'Diretores Gerais',
    premio: 'Rolex ou Cartier',
    img: '/images/premios/rolex.png',
  },
  {
    key: 'dubai',
    rank: 3,
    nivel: 'Nível 3',
    faturamento: 'R$ 1 milhão',
    faturamentoShort: '1M',
    cargoQtd: '6',
    cargoNome: 'Diretores Gerais',
    premio: 'Viagem a Dubai',
    img: '/images/premios/dubai.png',
  },
  {
    key: 'bmw',
    rank: 4,
    nivel: 'Nível 4',
    faturamento: 'R$ 4 milhões',
    faturamentoShort: '4M',
    cargoQtd: '10',
    cargoNome: 'Diretores Gerais',
    premio: 'BMW X4',
    img: '/images/premios/bmw.png',
  },
  {
    key: 'porsche',
    rank: 5,
    nivel: 'Nível 5',
    faturamento: 'R$ 10 milhões',
    faturamentoShort: '10M',
    cargoQtd: '16',
    cargoNome: 'Diretores Gerais',
    premio: 'Porsche 911',
    img: '/images/premios/porsche.png',
  },
  {
    key: 'ferrari',
    rank: 6,
    nivel: 'Nível Máximo',
    faturamento: 'R$ 16 milhões',
    faturamentoShort: '16M',
    cargoQtd: '22',
    cargoNome: 'Diretores Gerais',
    premio: 'Ferrari 296 GTS',
    img: '/images/premios/ferrari.png',
    featured: true,
  },
];

/* ── Progress bar widths (% de escala visual) ─────────────────── */
const SCALE: Record<string, number> = {
  iphone: 8,
  rolex: 16,
  dubai: 24,
  bmw: 46,
  porsche: 72,
  ferrari: 100,
};

/* ── Component ────────────────────────────────────────────────── */
export default function PremiosPage() {
  const featured = PREMIOS.find((p) => p.featured)!;
  const others = PREMIOS.filter((p) => !p.featured);
  const FeaturedIcon = ICONS[featured.key];

  return (
    <div className="portal-page">
      <section className="portal-shell prm3-root">

        {/* ════════ HEADER ════════ */}
        <header className="prm3-header">
          <div className="prm3-header-inner">
            <span className="prm3-eyebrow">
              <Trophy size={12} strokeWidth={2} />
              Programa de Recompensas
            </span>
            <h1 className="prm3-title">
              Conquiste Prêmios<br />
              <span className="prm3-title-accent">Extraordinários</span>
            </h1>
            <p className="prm3-subtitle">
              Cada nível desbloqueado é uma recompensa real,
              do iPhone à Ferrari.
            </p>
          </div>

          {/* Escada de progresso */}
          <div className="prm3-ladder" aria-label="Escala de prêmios">
            {PREMIOS.map((p) => {
              const Icon = ICONS[p.key];
              return (
                <div key={p.key} className={`prm3-ladder-step${p.featured ? ' is-top' : ''}`}>
                  <div className="prm3-ladder-icon">
                    <Icon size={14} strokeWidth={1.8} />
                  </div>
                  <div
                    className="prm3-ladder-bar"
                    style={{ height: `${SCALE[p.key]}%` }}
                    aria-hidden
                  />
                  <span className="prm3-ladder-label">{p.faturamentoShort}</span>
                </div>
              );
            })}
          </div>
        </header>

        {/* ════════ FEATURED ════════ */}
        <article className="prm3-featured" aria-label={`Prêmio máximo: ${featured.premio}`}>
          <div className="prm3-feat-img-wrap">
            <Image
              src={featured.img}
              alt={featured.premio}
              fill
              sizes="(max-width: 768px) 100vw, 55vw"
              className="prm3-feat-img"
              priority
            />
            <div className="prm3-feat-overlay" aria-hidden />
          </div>

          <div className="prm3-feat-body">
            <div className="prm3-feat-badge">
              <FeaturedIcon size={14} strokeWidth={2} />
              {featured.nivel}
            </div>
            <p className="prm3-feat-label">Prêmio Máximo</p>
            <h2 className="prm3-feat-prize">{featured.premio}</h2>

            <div className="prm3-feat-divider" aria-hidden />

            <div className="prm3-feat-meta">
              <div className="prm3-feat-meta-item">
                <TrendingUp size={14} strokeWidth={2} className="prm3-feat-meta-icon" />
                <div>
                  <span className="prm3-feat-meta-label">Faturamento mensal</span>
                  <span className="prm3-feat-meta-value">{featured.faturamento}</span>
                </div>
              </div>
              <div className="prm3-feat-meta-item">
                <Users size={14} strokeWidth={2} className="prm3-feat-meta-icon" />
                <div>
                  <span className="prm3-feat-meta-label">Cargo na rede</span>
                  <span className="prm3-feat-meta-value">
                    {featured.cargoQtd} {featured.cargoNome}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* ════════ GRID (outros 5) ════════ */}
        <div className="prm3-grid">
          {others.map((p) => {
            const Icon = ICONS[p.key];
            const delay = (p.rank - 1) * 70;
            return (
              <article
                key={p.key}
                className="prm3-card"
                data-prize={p.key}
                style={{ '--prm3-delay': `${delay}ms` } as React.CSSProperties}
              >
                {/* Image */}
                <div className="prm3-card-img-wrap">
                  <Image
                    src={p.img}
                    alt={p.premio}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="prm3-card-img"
                    priority={p.rank <= 2}
                  />
                  <div className="prm3-card-overlay" aria-hidden />

                  {/* Rank badge floating */}
                  <div className="prm3-card-rank">
                    <Icon size={13} strokeWidth={2} />
                    <span>{p.nivel}</span>
                  </div>
                </div>

                {/* Body */}
                <div className="prm3-card-body">
                  <h3 className="prm3-card-prize">{p.premio}</h3>

                  <div className="prm3-card-meta">
                    <div className="prm3-card-meta-item">
                      <span className="prm3-card-meta-label">Faturamento</span>
                      <span className="prm3-card-meta-value">{p.faturamento}</span>
                    </div>
                    <div className="prm3-card-meta-sep" aria-hidden />
                    <div className="prm3-card-meta-item">
                      <span className="prm3-card-meta-label">Cargo</span>
                      <span className="prm3-card-meta-value">
                        {p.cargoQtd} <span className="prm3-card-meta-soft">{p.cargoNome}</span>
                      </span>
                    </div>
                  </div>

                  {/* Scale bar */}
                  <div className="prm3-scale-wrap" aria-hidden>
                    <div
                      className="prm3-scale-fill"
                      style={{ width: `${SCALE[p.key]}%` }}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* ════════ NOTA ════════ */}
        <footer className="prm3-footer-note">
          <span className="prm3-footer-dot" aria-hidden />
          Prêmios <strong>não são cumulativos</strong>: o nível corresponde ao
          faturamento mensal total da rede e ao cargo dos membros ativos.
        </footer>

      </section>
    </div>
  );
}
