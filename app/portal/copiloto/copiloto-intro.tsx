'use client';

import './copiloto-intro.css';

/* ═══════════════════════════════════════════════════════════════════════════
   copiloto-intro.tsx — Tela de apresentação do Copiloto Comercial AXE PRIME
   ─────────────────────────────────────────────────────────────────────────
   COPY: adaptado do wireframe de referência → conceitos de Agentes + Skills
   DESIGN: identidade AXE Prime — navy escuro (#030b13) + cyan (#38bdf8)
           glassmorphism + glow + tipografia display-title
   ─────────────────────────────────────────────────────────────────────────
   USO: Renderizar ANTES de CopiloChat quando o membro acessa /portal/copiloto
        pela primeira vez (ou via botão "Conhecer" na home).
        Exemplo em page.tsx:
          import CopiloIntro from './copiloto-intro'
          // Exibe CopiloIntro com prop onStart que muda estado para exibir CopiloChat
═══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import Link from 'next/link';

/* ─── Tipos ─── */
interface IntroProps {
  /** Callback chamado quando o membro clica em "Ativar Copiloto" */
  onStart: () => void;
  /** Nome de exibição do agente (vem do banco via page.tsx) */
  agentName: string;
  /** Primeiro nome do membro */
  userName: string;
}

/* ─── Skills (habilidades) do Copiloto — usadas no bloco de cards centrais ─── */
const COPILOTO_SKILLS = [
  {
    id: 'vendas',
    /* Ícone: raio — símbolo de velocidade e impacto comercial */
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <polygon
          points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
          fill="rgba(56,189,248,0.15)"
          stroke="#38bdf8"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
    /* Skill 1: Processamento de vendas sem improviso */
    title: 'Skill de Vendas',
    description:
      'O agente analisa o perfil do cliente, identifica a dor financeira e monta o discurso certo, do primeiro contato ao fechamento, sem improviso.',
    badge: 'Alto Impacto',
  },
  {
    id: 'objecoes',
    /* Ícone: escudo — proteção contra objeções */
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
          fill="rgba(56,189,248,0.10)"
          stroke="#38bdf8"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
    /* Skill 2: Tratamento de objeções */
    title: 'Skill de Objeções',
    description:
      'Do "está caro" ao "parece pirâmide": o agente conhece cada barreira e te entrega argumentos empáticos, precisos e validados pela operação AXE Prime.',
    badge: 'Conversão',
  },
  {
    id: 'carreira',
    /* Ícone: gráfico de linha — crescimento de carreira */
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <polyline
          points="22 12 18 12 15 21 9 3 6 12 2 12"
          stroke="#38bdf8"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    /* Skill 3: Plano de ascensão de carreira */
    title: 'Skill de Carreira',
    description:
      'O agente lê onde você está na estrutura e traça o caminho prático para o próximo nível, com metas claras, ações concretas e sem achismo.',
    badge: 'Estratégico',
  },
  {
    id: 'scripts',
    /* Ícone: mensagem — scripts prontos para WhatsApp */
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          fill="rgba(56,189,248,0.10)"
          stroke="#38bdf8"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
    /* Skill 4: Scripts prontos */
    title: 'Skill de Scripts',
    description:
      'Mensagens de abordagem, reengajamento e urgência, personalizadas para o seu contexto, prontas para enviar no WhatsApp com um toque.',
    badge: 'Pronto-Uso',
  },
  {
    id: 'diagnostico',
    /* Ícone: lupa — diagnóstico financeiro */
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="11" cy="11" r="8" stroke="#38bdf8" strokeWidth="1.6" />
        <line
          x1="21"
          y1="21"
          x2="16.65"
          y2="16.65"
          stroke="#38bdf8"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    ),
    /* Skill 5: Diagnóstico financeiro do cliente */
    title: 'Skill de Diagnóstico',
    description:
      'Com 5 perguntas estratégicas, o agente mapeia o momento financeiro do seu cliente e indica se o plano AXE Prime é o encaixe certo — agora ou depois.',
    badge: 'Precisão',
  },
  {
    id: 'persona',
    /* Ícone: configurações — personalização do agente */
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="3" stroke="#38bdf8" strokeWidth="1.6" />
        <path
          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          stroke="#38bdf8"
          strokeWidth="1.6"
        />
      </svg>
    ),
    /* Skill 6: Personalização da persona do agente */
    title: 'Skill de Persona',
    description:
      'Defina o nome, o tom e o estilo do seu agente. Ele se adapta à sua linguagem e ao perfil da sua rede — quanto mais você treina, melhor ele performa.',
    badge: 'Adaptativo',
  },
];

/* ─── Quick-actions preview — mostra ao membro o que pode fazer de imediato ─── */
const PREVIEW_ACTIONS = [
  { emoji: '🎭', label: 'Simular cliente difícil' },
  { emoji: '💸', label: 'Tratar objeção "está caro"' },
  { emoji: '📋', label: 'Gerar script de abordagem' },
  { emoji: '🔍', label: 'Diagnóstico do cliente' },
  { emoji: '💬', label: 'Resgatar quem sumiu' },
  { emoji: '📈', label: 'Avançar de nível' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════════════════════ */
export default function CopiloIntro({ onStart, agentName, userName }: IntroProps) {
  /* Estado local para animação do CTA ao clicar */
  const [activating, setActivating] = useState(false);

  function handleStart() {
    setActivating(true);
    /* Pequeno delay para feedback visual antes de trocar a tela */
    setTimeout(onStart, 420);
  }

  return (
    /* ── Container da página — herda .portal-page do shell ── */
    <div className="portal-page cop-intro-page">

      {/* ════════════════════════════════════════════════════════════
          BLOCO 1 — HERO
          Título impactante + subtítulo + CTA primário
      ════════════════════════════════════════════════════════════ */}
      <section className="cop-intro-hero" aria-labelledby="copiloto-hero-title">

        {/* Orbe de glow decorativo — fundo cyan suave */}
        <div className="cop-intro-hero-orb" aria-hidden />

        {/* Kicker — label de categoria acima do título */}
        <p className="cop-intro-kicker">
          {/* Ícone de raio inline */}
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
            <polygon
              points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
              fill="currentColor"
            />
          </svg>
          Agente Comercial Exclusivo
        </p>

        {/* Título principal — display-title, hierarquia H1 */}
        <h1 id="copiloto-hero-title" className="cop-intro-title">
          {/* Primeira linha: nome do membro — personalização */}
          {userName.split(' ')[0]}, conheça o seu<br />
          {/* Segunda linha: destaque em cyan */}
          <span className="cop-intro-title-accent">{agentName}.</span>
        </h1>

        {/* Subtítulo — proposta de valor principal */}
        <p className="cop-intro-subtitle">
          Um agente de inteligência treinado para a realidade comercial da AXE Prime.
          Ele domina scripts, objeções, diagnóstico de clientes e plano de carreira —
          e está disponível a qualquer hora, sem esperar o gestor.
        </p>

        {/* ── Métricas sociais — prova de impacto compacta ── */}
        <div className="cop-intro-metrics" role="list" aria-label="Indicadores do Copiloto">
          <div className="cop-intro-metric" role="listitem">
            <span className="cop-intro-metric-value">6</span>
            <span className="cop-intro-metric-label">Skills ativas</span>
          </div>
          <div className="cop-intro-metric-divider" aria-hidden />
          <div className="cop-intro-metric" role="listitem">
            <span className="cop-intro-metric-value">∞</span>
            <span className="cop-intro-metric-label">Cenários de treino</span>
          </div>
          <div className="cop-intro-metric-divider" aria-hidden />
          <div className="cop-intro-metric" role="listitem">
            <span className="cop-intro-metric-value">24/7</span>
            <span className="cop-intro-metric-label">Disponibilidade</span>
          </div>
        </div>

        {/* ── CTA principal ── */}
        <button
          type="button"
          className={`cop-intro-cta-primary${activating ? ' cop-intro-cta--activating' : ''}`}
          onClick={handleStart}
          disabled={activating}
          aria-label={`Ativar ${agentName} e iniciar conversa`}
        >
          {activating ? (
            /* Feedback visual durante ativação */
            <>
              <span className="cop-intro-cta-spinner" aria-hidden />
              Ativando agente…
            </>
          ) : (
            <>
              {/* Ícone de raio no botão */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <polygon
                  points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                  fill="currentColor"
                />
              </svg>
              Ativar {agentName}
            </>
          )}
        </button>

        {/* ── Nota de segurança / contexto ── */}
        <p className="cop-intro-hero-note">
          Conversas privadas. Histórico local. Zero exposição de dados da operação.
        </p>
      </section>

      {/* ════════════════════════════════════════════════════════════
          BLOCO 2 — SKILLS CARDS
          Grid de 6 cards com as habilidades do agente
      ════════════════════════════════════════════════════════════ */}
      <section className="cop-intro-skills-section" aria-labelledby="skills-title">
        <div className="cop-intro-section-head">
          <p className="cop-intro-section-kicker">O que o agente domina</p>
          <h2 id="skills-title" className="cop-intro-section-title">
            6 Skills. Uma estrutura de resultado.
          </h2>
          <p className="cop-intro-section-desc">
            Cada skill foi calibrada com base nos padrões de conversação e objeção
            mais frequentes dentro da rede AXE Prime. O agente não improvisa —
            ele executa com precisão.
          </p>
        </div>

        {/* Grid responsivo: 3 cols desktop / 2 cols tablet / 1 col mobile */}
        <div className="cop-intro-skills-grid" role="list" aria-label="Skills do Copiloto">
          {COPILOTO_SKILLS.map((skill) => (
            <article
              key={skill.id}
              className="cop-intro-skill-card"
              role="listitem"
            >
              {/* Ícone com fundo glassmorphism */}
              <div className="cop-intro-skill-icon" aria-hidden>
                {skill.icon}
              </div>

              {/* Badge de categoria */}
              <span className="cop-intro-skill-badge">{skill.badge}</span>

              {/* Título da skill */}
              <h3 className="cop-intro-skill-title">{skill.title}</h3>

              {/* Descrição da skill */}
              <p className="cop-intro-skill-desc">{skill.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          BLOCO 3 — QUICK-ACTIONS PREVIEW
          Mostra os atalhos disponíveis para instigar o membro
      ════════════════════════════════════════════════════════════ */}
      <section className="cop-intro-actions-section" aria-labelledby="actions-title">
        <div className="cop-intro-actions-inner">
          <div className="cop-intro-section-head cop-intro-section-head--center">
            <p className="cop-intro-section-kicker">Atalhos de alto impacto</p>
            <h2 id="actions-title" className="cop-intro-section-title">
              Escolha. Execute. Evolua.
            </h2>
            <p className="cop-intro-section-desc">
              Seis cenários de treinamento prontos para acionar — em qualquer lugar,
              a qualquer hora. Sem necessidade de digitar uma longa instrução.
            </p>
          </div>

          {/* Lista de ações em formato de chips clicáveis — visual apenas (preview) */}
          <div className="cop-intro-actions-grid" role="list" aria-label="Ações rápidas disponíveis">
            {PREVIEW_ACTIONS.map((action) => (
              <div
                key={action.label}
                className="cop-intro-action-chip"
                role="listitem"
                /* Preview apenas — clique real acontece dentro do chat */
                aria-label={action.label}
              >
                <span className="cop-intro-action-emoji" aria-hidden>
                  {action.emoji}
                </span>
                <span className="cop-intro-action-label">{action.label}</span>
                {/* Seta indicativa */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                  className="cop-intro-action-arrow"
                >
                  <polyline
                    points="9 18 15 12 9 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          BLOCO 4 — COMO FUNCIONA (3 passos)
          Processo simples: Acione → Treine → Aplique
      ════════════════════════════════════════════════════════════ */}
      <section className="cop-intro-how-section" aria-labelledby="how-title">
        <div className="cop-intro-section-head cop-intro-section-head--center">
          <p className="cop-intro-section-kicker">Como funciona</p>
          <h2 id="how-title" className="cop-intro-section-title">
            Do acionamento ao resultado.
          </h2>
        </div>

        <div className="cop-intro-steps" role="list" aria-label="Passos para usar o Copiloto">

          {/* Passo 1 */}
          <div className="cop-intro-step" role="listitem">
            <div className="cop-intro-step-number" aria-hidden>01</div>
            <div className="cop-intro-step-content">
              <h3 className="cop-intro-step-title">Acione o agente</h3>
              <p className="cop-intro-step-desc">
                Escolha um atalho de alto impacto ou descreva livremente o que
                está enfrentando agora na sua operação comercial.
              </p>
            </div>
          </div>

          {/* Conector de linha */}
          <div className="cop-intro-step-connector" aria-hidden />

          {/* Passo 2 */}
          <div className="cop-intro-step" role="listitem">
            <div className="cop-intro-step-number" aria-hidden>02</div>
            <div className="cop-intro-step-content">
              <h3 className="cop-intro-step-title">Treine e refine</h3>
              <p className="cop-intro-step-desc">
                Simule conversas reais, testate objeções e receba feedback
                instantâneo. Cada sessão fortalece sua capacidade de venda.
              </p>
            </div>
          </div>

          {/* Conector de linha */}
          <div className="cop-intro-step-connector" aria-hidden />

          {/* Passo 3 */}
          <div className="cop-intro-step" role="listitem">
            <div className="cop-intro-step-number" aria-hidden>03</div>
            <div className="cop-intro-step-content">
              <h3 className="cop-intro-step-title">Aplique com precisão</h3>
              <p className="cop-intro-step-desc">
                Leve o script, o argumento ou o plano de carreira gerado
                direto para a conversa com o seu cliente. Sem teoria — só prática.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          BLOCO 5 — CTA FINAL (ancoragem / reforço)
          Repetição do CTA ao fim da página para quem scrollou
      ════════════════════════════════════════════════════════════ */}
      <section className="cop-intro-cta-section" aria-labelledby="cta-bottom-title">
        <div className="cop-intro-cta-card">
          {/* Orbe decorativo no card */}
          <div className="cop-intro-cta-orb" aria-hidden />

          {/* Kicker */}
          <p className="cop-intro-kicker">Pronto para avançar?</p>

          {/* Título do CTA */}
          <h2 id="cta-bottom-title" className="cop-intro-cta-title">
            Seu agente está esperando.
          </h2>

          {/* Texto de apoio */}
          <p className="cop-intro-cta-desc">
            Ative agora e comece pelo atalho que faz mais sentido para o momento
            que você está vivendo na operação. O {agentName} está online.
          </p>

          {/* Botão CTA duplicado com mesma lógica do hero */}
          <button
            type="button"
            className={`cop-intro-cta-primary${activating ? ' cop-intro-cta--activating' : ''}`}
            onClick={handleStart}
            disabled={activating}
            aria-label={`Ativar ${agentName} e iniciar conversa`}
          >
            {activating ? (
              <>
                <span className="cop-intro-cta-spinner" aria-hidden />
                Ativando agente…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" />
                </svg>
                Ativar {agentName}
              </>
            )}
          </button>

          {/* Link alternativo para quem já conhece e quer pular intro */}
          <Link href="/portal" className="cop-intro-cta-secondary">
            Voltar ao painel
          </Link>
        </div>
      </section>

    </div>
  );
}
