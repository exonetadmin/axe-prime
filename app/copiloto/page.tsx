import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Globe2,
  Layers3,
  Gem,
  Network,
  TrendingUp,
  Sparkles,
  LogIn,
  Search,
  MessageSquare,
  FileText,
  Brain,
  CheckCircle2,
  X,
} from 'lucide-react';

import Header from '@/components/header';
import Reveal from '@/components/reveal';
import { copilotoFeatures } from '@/lib/site-content';
import NeuralBg from './neural-bg';
import CopilotoFooter from './copiloto-footer';

/* ── Metadata ────────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: 'Copiloto IA — AXE PRIME',
  description:
    'A primeira empresa de network marketing do mundo a integrar IA avançada na jornada de cada membro. Análise patrimonial, plano de carreira e consultoria 24/7.',
  alternates: { canonical: 'https://www.axeprime.com.br/copiloto' },
};

/* ── Icon map ─────────────────────────────────────────────────── */
const iconMap: Record<string, React.FC<{ size?: number; strokeWidth?: number }>> = {
  network: Network,
  chart: TrendingUp,
  sparkles: Sparkles,
  globe: Globe2,
  layers: Layers3,
  gem: Gem,
};

/* ── Stats ────────────────────────────────────────────────────── */
const stats = [
  { value: '1ª', label: 'empresa de network com IA avançada' },
  { value: '2026', label: 'integração da nossa IA' },
  { value: 'Online', label: 'a IA faz tudo por você, menos a venda' },
];

/* ── Steps (5) ────────────────────────────────────────────────── */
const steps = [
  {
    n: '01',
    icon: LogIn,
    title: 'Você acessa o Copiloto',
    body: 'Disponível direto no portal AXE PRIME para todos os membros ativos. Sem instalação. Basta estar logado.',
  },
  {
    n: '02',
    icon: Search,
    title: 'A IA lê seu perfil',
    body: 'O sistema cruza sua camada atual, histórico de aportes, posição na rede e objetivos declarados para montar um contexto completo.',
  },
  {
    n: '03',
    icon: MessageSquare,
    title: 'Você faz sua pergunta',
    body: 'Sobre seu próximo investimento, como crescer sua rede ou a melhor estratégia para avançar de camada. A IA entende tudo.',
  },
  {
    n: '04',
    icon: FileText,
    title: 'Resposta com profundidade',
    body: 'Nada de respostas vagas. O Copiloto entrega análise contextualizada, dados do seu histórico e sugestões concretas de ação.',
  },
  {
    n: '05',
    icon: Brain,
    title: 'Aprende com o tempo',
    body: 'A cada interação, o sistema refina seu entendimento do seu perfil e entrega orientações cada vez mais precisas.',
  },
];

/* ── Marco Histórico ──────────────────────────────────────────── */
const before = [
  'Orientação dependente de líderes disponíveis',
  'Análises manuais e imprecisas',
  'Decisões por intuição',
];

const after = [
  'IA disponível 24h, 7 dias por semana',
  'Análise automática do seu perfil completo',
  'Decisões com dados e contexto real',
];

/* ── Page ─────────────────────────────────────────────────────── */
export default function CopilotoPage() {
  return (
    <div className="page-shell cop-page">
      {/* Background neural network animado */}
      <NeuralBg />
      <Header />

      <main>
        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="section cop-hero">
          <Reveal className="cop-hero-copy">
            <span className="eyebrow">Copiloto AXE</span>
            <h1 className="display-title">
              A IA que<br />redefine o<br />network.
            </h1>
            <p className="lead">
              Somos a primeira empresa de network marketing do mundo a integrar inteligência artificial avançada diretamente na jornada de cada membro.
            </p>
            <p className="cop-hero-subtext">
              O Copiloto AXE não é um chatbot. É um sistema de orientação patrimonial que aprende com o seu perfil e entrega direção com precisão.
            </p>
            <div className="hero-actions">
              <Link href="/auth?mode=register" className="primary-button">
                Entrar na estrutura
                <ArrowRight size={18} strokeWidth={1.8} />
              </Link>
              <Link href="/auth" className="secondary-button">
                Já tenho conta
              </Link>
            </div>
          </Reveal>

          {/* Chat mockup */}
          <Reveal delay={80} className="cop-hero-mockup">
            <div className="cop-mock-card shell-panel">
              <div className="cop-mock-header">
                <span className="cop-preview-dot" />
                <span className="cop-preview-label">Copiloto AXE</span>
                <span className="cop-preview-status">online</span>
              </div>
              <div className="cop-mock-body">
                <div className="cop-msg cop-msg-bot">
                  Olá. Sou o Copiloto da AXE PRIME. Como posso orientar sua estratégia hoje?
                </div>
                <div className="cop-msg cop-msg-user">
                  Qual o próximo passo para avançar de camada?
                </div>
                <div className="cop-msg cop-msg-bot">
                  Com base no seu perfil atual, você está a 2 aportes do critério de Advisor. Quer que eu monte um plano de ação para as próximas 4 semanas?
                </div>
                <div className="cop-mock-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="cop-mock-footer-bar">
                <span className="cop-mock-input-hint">Digite sua pergunta…</span>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Stats ─────────────────────────────────────────── */}
        <Reveal>
          <div className="cop-stats-row">
            {stats.map(s => (
              <div key={s.value} className="cop-stat">
                <span className="cop-stat-value">{s.value}</span>
                <span className="cop-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </Reveal>

        <div className="glass-divider" />

        {/* ── Capacidades ────────────────────────────────────── */}
        <section className="section" aria-labelledby="cop-features-heading">
          <Reveal className="section-heading">
            <span className="section-label">Capacidades</span>
            <h2 id="cop-features-heading" className="section-title">
              O que a IA faz por você.
            </h2>
            <p className="section-copy">
              Seis eixos de inteligência para elevar cada decisão que você toma dentro da estrutura.
            </p>
          </Reveal>

          <Reveal>
            <div className="cop-features-grid">
              {copilotoFeatures.map(item => {
                const IconComp = iconMap[item.icon] ?? Sparkles;
                return (
                  <article key={item.title} className="cop-feature-card shell-panel">
                    <div className="cop-feature-top">
                      <span className="cop-feature-chip" aria-hidden="true">
                        <IconComp size={16} strokeWidth={1.7} />
                      </span>
                      <span className="cop-feature-eyebrow">{item.eyebrow}</span>
                    </div>
                    <h3 className="cop-feature-title">{item.title}</h3>
                    <p className="cop-feature-body">{item.body}</p>
                    {item.tag && (
                      <p className="cop-feature-tag">{item.tag}</p>
                    )}
                  </article>
                );
              })}
            </div>
          </Reveal>
        </section>

        <div className="glass-divider" />

        {/* ── Marco Histórico ───────────────────────────────── */}
        <section className="section cop-marco-section" aria-labelledby="cop-marco-heading">
          <Reveal className="section-heading">
            <span className="section-label">Marco Histórico</span>
            <h2 id="cop-marco-heading" className="section-title">
              A primeira do mundo.<br />Com prova de conceito.
            </h2>
            <p className="section-copy">
              Enquanto outras empresas de network ainda dependem de liderança humana e planilhas, a AXE PRIME integrou IA avançada ao núcleo operacional da sua estrutura.
            </p>
          </Reveal>

          <Reveal>
            <div className="cop-marco-grid">
              <div className="cop-marco-col cop-marco-before shell-panel">
                <p className="cop-marco-col-label">Antes</p>
                <ul className="cop-marco-list">
                  {before.map(item => (
                    <li key={item} className="cop-marco-item">
                      <X size={15} strokeWidth={2} className="cop-marco-icon cop-icon-before" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="cop-marco-col cop-marco-after shell-panel">
                <p className="cop-marco-col-label">Agora</p>
                <ul className="cop-marco-list">
                  {after.map(item => (
                    <li key={item} className="cop-marco-item">
                      <CheckCircle2 size={15} strokeWidth={2} className="cop-marco-icon cop-icon-after" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </section>

        <div className="glass-divider" />

        {/* ── Passo a Passo 5 steps ─────────────────────────── */}
        <section className="section" aria-labelledby="cop-steps-heading">
          <Reveal className="section-heading">
            <span className="section-label">Passo a passo</span>
            <h2 id="cop-steps-heading" className="section-title">
              Como o Copiloto funciona na prática.
            </h2>
          </Reveal>

          <Reveal>
            <div className="cop-steps-v">
              {steps.map(step => {
                const StepIcon = step.icon;
                return (
                  <article key={step.n} className="cop-step-v">
                    <div className="cop-step-v-left">
                      <div className="cop-step-v-dot">
                        <StepIcon size={18} strokeWidth={1.7} />
                      </div>
                      <div className="cop-step-v-line" aria-hidden="true" />
                    </div>
                    <div className="cop-step-v-body">
                      <span className="cop-step-v-num">{step.n}</span>
                      <h3 className="cop-step-v-title">{step.title}</h3>
                      <p className="cop-step-v-text">{step.body}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </Reveal>
        </section>

        <div className="glass-divider" />

        {/* ── CTA Final ─────────────────────────────────────── */}
        <section className="section cop-cta-section">
          <Reveal>
            <div className="cop-cta-box shell-panel">
              <span className="section-label">Acesso imediato</span>
              <h2 className="section-title cop-cta-title">
                Pronto para um consultor<br />que nunca dorme?
              </h2>
              <p className="section-copy">
                O Copiloto IA está disponível assim que você entra na estrutura. Acesse agora e comece com a primeira consulta estratégica.
              </p>
              <Link href="/auth?mode=register" className="primary-button cop-cta-btn">
                Entrar para a estrutura
                <ArrowRight size={18} strokeWidth={1.8} />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <CopilotoFooter />
    </div>
  );
}
