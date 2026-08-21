import type { LucideIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BriefcaseBusiness,
  Building2,
  Calculator,
  CarFront,
  CircleDollarSign,
  Crown,
  Gem,
  Globe2,
  House,
  Layers3,
  Network,
  Plane,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import HeroBackground from '@/components/hero-background';
import Reveal from '@/components/reveal';
import Header from '@/components/header';
import MobileCtaBar from '@/components/mobile-cta-bar';
import CountUp from '@/components/count-up';
import SiteFooter from '@/components/site-footer';
import {
  ascensionRequirements,
  careerSteps,
  faqItems,
  heroMetrics,
  lifestyleBenefits,
  proofHighlights,
  siteUrl,
  strategicPillars,
  testimonials,
  type IconKey,
} from '@/lib/site-content';
import { seoCopy } from '@/lib/seo-copy';
import CinematicMedia from '@/components/cinematic-media';
import { getLandingMedia } from '@/lib/media-assets';

const FaqAccordion = dynamic(() => import('@/components/faq-accordion'), {
  loading: () => <div className="skeleton-faq" />,
});

const TestimonialGrid = dynamic(() => import('@/components/testimonial-grid'), {
  loading: () => <div className="skeleton-testimonials" />,
});

const iconMap: Record<IconKey, LucideIcon> = {
  award: Award,
  banknote: CircleDollarSign,
  briefcase: BriefcaseBusiness,
  building: Building2,
  car: CarFront,
  chart: TrendingUp,
  crown: Crown,
  gem: Gem,
  globe: Globe2,
  home: House,
  layers: Layers3,
  network: Network,
  plane: Plane,
  shield: ShieldCheck,
  sparkles: Sparkles,
  wallet: Wallet,
};

function SectionIcon({ icon }: { icon: IconKey }) {
  const Icon = iconMap[icon];

  return (
    <span className="icon-chip" aria-hidden="true">
      <Icon size={18} strokeWidth={1.7} />
    </span>
  );
}

export default function HomePage() {
  const media = getLandingMedia();
  const leadPillar = strategicPillars[0];
  const remainingPillars = strategicPillars.slice(1);
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'AXE PRIME',
      url: siteUrl,
      logo: `${siteUrl}/brand/axe-prime-logotype.png`,
      description: seoCopy.organizationDescription,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      serviceType: 'Estratégia patrimonial',
      provider: {
        '@type': 'Organization',
        name: 'AXE PRIME',
      },
      areaServed: 'Brasil',
      description: seoCopy.serviceDescription,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  ];

  return (
    <>
      <HeroBackground />
      <MobileCtaBar />

      <main className="page-shell">
        <Header />

        <section className="section hero" id="top">
          <Reveal>
            <div className="hero-copy">
              <span className="eyebrow">Arquitetura patrimonial</span>
              <h1 className="display-title">Patrimônio em outra escala.</h1>
              <p className="lead">
                Uma estrutura pensada para transformar capital em movimento, aquisição planejada e
                expansão com leitura de longo prazo.
              </p>

              <div className="hero-proof-stack">
                <p className="hero-proof">
                  Origem em 2016, com fundadores formados no Brasil e nos Estados Unidos.
                </p>
                <p className="hero-proof hero-proof-highlight">
                  Entrada condicionada apenas por convite, acompanhamento patrimonial e direção
                  estratégica.
                </p>
              </div>

              <div className="hero-actions">
                <Link href="/auth?mode=register" className="primary-button">
                  Entrar para a estrutura
                  <ArrowRight size={18} strokeWidth={1.8} />
                </Link>
                <a href="#beneficios" className="secondary-button">
                  Conhecer a jornada
                </a>
              </div>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="hero-media-stack">
              <CinematicMedia {...media.heroLoop} variant="hero" priority />
            </div>
          </Reveal>
        </section>

        <Reveal>
          <section className="metrics-grid" aria-label="Destaques estratégicos">
            {heroMetrics.map(metric => (
              <article key={metric.label} className="metric-card">
                <p className="metric-value">
                  {metric.countTo != null ? (
                    metric.label === 'membros ativos' ? (
                      <>
                        +<CountUp end={metric.countTo} />
                      </>
                    ) : (
                      <>
                        <CountUp end={metric.countTo} suffix="% de volta" />
                      </>
                    )
                  ) : (
                    metric.value
                  )}
                </p>
                <p className="metric-label">{metric.label}</p>
                <p className="metric-note">{metric.note}</p>
              </article>
            ))}
          </section>
        </Reveal>

        <div className="glass-divider" />

        <section className="section" id="manifesto">
          <Reveal className="section-heading">
            <span className="section-label">Direção</span>
            <h2 className="section-title">Capital bem posicionado ganha permanência.</h2>
            <p className="section-copy">
              Quando a estrutura é correta, patrimônio deixa de ser intenção e passa a operar com
              clareza.
            </p>
          </Reveal>

          <div className="manifest-grid">
            <Reveal>
              <article className="story-card">
                <span className="section-label">Nossa missão</span>
                <p className="story-quote">
                  Conectar pessoas a estratégias tradicionalmente restritas a grandes investidores.
                </p>
                <p className="section-copy">
                  Por meio de ações estruturadas e networking de alta performance.
                </p>
                <div className="inline-metric">
                  <p className="muted">Nosso diferencial</p>
                  <strong>
                    Transformamos investimento em alavancagem patrimonial real, oferecendo cashback
                    imediato enquanto seu capital se multiplica.
                  </strong>
                </div>
              </article>
            </Reveal>

            <Reveal delay={120}>
              <aside className="proof-card">
                <div className="proof-list">
                  {proofHighlights.map(item => (
                    <div key={item} className="proof-item">
                      <SectionIcon icon="shield" />
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              </aside>
            </Reveal>
          </div>
        </section>

        <section className="section" id="beneficios">
          <Reveal className="section-heading">
            <span className="section-label">Benefícios estratégicos</span>
            <h2 className="section-title">
              Liquidez, aquisição e presença dentro da mesma estrutura.
            </h2>
            <p className="section-copy">
              Retorno, planejamento e estilo de vida sob a mesma disciplina de capital.
            </p>
          </Reveal>

          <div className="benefits-showcase">
            <Reveal>
              <CinematicMedia {...media.benefitsImage} variant="section" />
            </Reveal>

            <Reveal delay={80}>
              <div className="benefits-showcase-copy shell-panel narrative-panel">
                <span className="section-label">Frentes principais</span>
                <h3 className="content-card-title benefits-title">
                  Uma leitura única para capital, aquisição e qualidade de vida.
                </h3>
                <p className="content-card-body">
                  A experiência não fragmenta a jornada: ela organiza presente e longo prazo na
                  mesma direção.
                </p>
                <div className="hero-category-grid">
                  <span className="category-chip">Liquidez</span>
                  <span className="category-chip">Aquisição</span>
                  <span className="category-chip">Amplitude</span>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal>
            <div className="benefits-primary-grid">
              <article className="content-card content-card-emphasis">
                <SectionIcon icon={leadPillar.icon} />
                {leadPillar.eyebrow ? (
                  <p className="content-card-eyebrow">{leadPillar.eyebrow}</p>
                ) : null}
                <h3 className="content-card-title">{leadPillar.title}</h3>
                <p className="content-card-body">{leadPillar.body}</p>
              </article>

              {remainingPillars.map(item => (
                <article key={item.title} className="content-card content-card-primary">
                  <SectionIcon icon={item.icon} />
                  {item.eyebrow ? <p className="content-card-eyebrow">{item.eyebrow}</p> : null}
                  <h3 className="content-card-title">{item.title}</h3>
                  <p className="content-card-body">{item.body}</p>
                </article>
              ))}
            </div>
          </Reveal>

          <Reveal delay={60}>
            <div className="benefits-secondary-grid">
              {lifestyleBenefits.map(item => (
                <article key={item.title} className="content-card content-card-secondary">
                  <SectionIcon icon={item.icon} />
                  <h3 className="content-card-title">{item.title}</h3>
                  <p className="content-card-body">{item.body}</p>
                </article>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Testimonials section — Sprint 3 */}
        <section className="section" id="depoimentos">
          <Reveal className="section-heading">
            <span className="section-label">Quem já está na estrutura</span>
            <h2 className="section-title">Resultados reais de quem decidiu agir.</h2>
            <p className="section-copy">
              Membros em diferentes camadas, na mesma trajetória de crescimento patrimonial.
            </p>
          </Reveal>

          <Reveal>
            <TestimonialGrid items={testimonials} />
          </Reveal>
        </section>

        <section className="section alt-surface" id="carreira">
          <Reveal className="section-heading">
            <span className="section-label">Carreira e ascensão</span>
            <h2 className="section-title">Comece como afiliado e poderá participar de nosso modelo partnership.</h2>
            <p className="section-copy">
              Avance em sua organização, desbloqueando novos fee com nosso modelo exclusivo de overriding, baseado em relacionamento, consistência e formação.
            </p>
          </Reveal>

          <Reveal>
            <div className="career-path">
              {careerSteps.map((step, index) => (
                <article key={step.role} className="career-step">
                  <div className="career-step-head">
                    <p className="career-step-index">Etapa {String(index + 1).padStart(2, '0')}</p>
                  </div>
                  <div className="career-step-copy">
                    <p className="career-step-role">{step.role}</p>
                    <p className="career-step-summary">{step.summary}</p>
                  </div>
                </article>
              ))}
            </div>
          </Reveal>

          <div className="split-grid">
            <Reveal>
              <article className="story-card proof-stack-card">
                <span className="section-label">Requisitos de ascensão</span>
                {ascensionRequirements.map(item => (
                  <div key={item.title} className="proof-item">
                    <SectionIcon icon={item.icon} />
                    <div className="proof-item-copy">
                      <p className="proof-item-title">{item.title}</p>
                      <p className="proof-item-body">{item.body}</p>
                    </div>
                  </div>
                ))}
              </article>
            </Reveal>

            <Reveal delay={120}>
              <div className="media-column">
                <CinematicMedia {...media.careerImage} variant="compact" />
              </div>
            </Reveal>
          </div>

        </section>

        <section className="section" id="faq">
          <Reveal className="section-heading">
            <span className="section-label">FAQ</span>
            <h2 className="section-title">
              Perguntas que surgem antes de uma decisão patrimonial mais relevante.
            </h2>
            <p className="section-copy">Clareza antes da decisão. Sempre.</p>
          </Reveal>

          <FaqAccordion items={faqItems} />
        </section>

        <section className="section" id="simulador-preview">
          <Reveal>
            <article className="simulator-preview-card">
              <div className="simulator-preview-glow" />
              <div className="simulator-preview-content">
                <div className="simulator-preview-icon">
                  <Calculator size={32} strokeWidth={1.5} />
                </div>
                <span className="section-label simulator-preview-label">Simule seu cenário</span>
                <h2 className="simulator-preview-title">
                  Descubra o potencial da sua jornada patrimonial.
                </h2>
                <p className="simulator-preview-copy">
                  Simule diferentes cenários de investimento, visualize cashback acumulado
                  e projeção de patrimônio ao longo do tempo.
                </p>
                <Link href="/simulador" className="primary-button simulator-preview-button">
                  <Calculator size={18} strokeWidth={1.8} />
                  Abrir simulador de investimentos
                  <ArrowRight size={18} strokeWidth={1.8} />
                </Link>
              </div>
              <div className="simulator-preview-visual">
                <div className="simulator-preview-chart-line" />
                <div className="simulator-preview-chart-bar" />
                <div className="simulator-preview-chart-bar" />
                <div className="simulator-preview-chart-bar" />
                <div className="simulator-preview-chart-dot" />
              </div>
            </article>
          </Reveal>
        </section>

        <section className="section">
          <Reveal>
            <article className="cta-panel glass-panel cta-panel-editorial">
              <div className="cta-copy">
                <span className="section-label">Entrada reservada</span>
                <h2 className="section-title">
                  Entre apenas se fizer sentido para o seu momento patrimonial.
                </h2>
                <p className="section-copy">
                  A jornada começa com análise, clareza e direcionamento. Sem urgência artificial.
                  Sem excesso de ruído. Apenas a estrutura certa para o momento certo.
                </p>
              </div>

              <div className="hero-actions">
                <Link href="/auth?mode=register" className="primary-button">
                  Entrar para a estrutura
                  <ArrowRight size={18} strokeWidth={1.8} />
                </Link>
                <Link href="/auth" className="secondary-button">
                  Já tenho acesso
                </Link>
              </div>
            </article>
          </Reveal>
        </section>

        <SiteFooter />
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}
