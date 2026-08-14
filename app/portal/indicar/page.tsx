import Image from 'next/image';
import { getAuthenticatedUser } from '@/lib/auth';
import { siteUrl } from '@/lib/site-content';
import PortalIndicarClient from './portal-indicar-client';

export const dynamic = 'force-dynamic';

const STEPS = [
  {
    num: '01',
    title: 'Compartilhe',
    desc: 'Envie seu link ou código pessoal para contatos pelo WhatsApp, redes sociais ou onde preferir.',
  },
  {
    num: '02',
    title: 'Seu indicado se cadastra',
    desc: 'Ele escolhe o plano, assina o contrato e já aparece na sua rede, sem fricção.',
  },
  {
    num: '03',
    title: 'Você recebe',
    desc: '10% sobre o aporte mensal do indicado direto, creditado todo mês por 12 meses seguidos.',
  },
];

const STATS = [
  { value: '10%', label: 'sobre diretos', sub: 'por indicação direta' },
  { value: '12×', label: 'meses pagos', sub: 'recorrência garantida' },
  { value: '8%', label: 'rede indireta', sub: 'até Diretor Geral' },
];

export default async function PortalIndicarPage() {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const code = (user.referralCode ?? '').trim();
  const referralUrl = code
    ? `${siteUrl}/auth?ref=${encodeURIComponent(code)}`
    : '';

  return (
    <div className="portal-page">
      <section className="portal-shell">

        {/* ════════ HERO ════════ */}
        <article className="ind-hero-card">

          {/* Imagem de fundo — aspiracional */}
          <div className="ind-hero-image-wrap" aria-hidden>
            <Image
              src="/media/axe-reward-dubai.webp"
              alt=""
              fill
              className="ind-hero-image"
              sizes="(max-width: 768px) 100vw, 800px"
              priority
            />
            <div className="ind-hero-image-fade" />
          </div>

          {/* Orb azul — igual ao carreira */}
          <div className="ind-hero-orb" aria-hidden />

          {/* Conteúdo */}
          <div className="ind-hero-inner">
            <div className="ind-hero-left">
              <span className="ind-hero-eyebrow">Programa de Indicação</span>
              <div className="ind-hero-pct-wrap">
                <span className="ind-hero-pct">10%</span>
                <span className="ind-hero-pct-suffix">a.m.</span>
              </div>
              <span className="ind-hero-pct-label">
                sobre cada aporte direto
              </span>
            </div>

            <div className="ind-hero-right">
              <p className="ind-hero-desc">
                Indique pessoas. Elas investem. Você ganha uma comissão mensal
                recorrente, sem limites de indicações e sem esforço adicional.
              </p>

              {/* Stats inline */}
              <div className="ind-hero-stats">
                {STATS.map((s) => (
                  <div key={s.value} className="ind-hero-stat">
                    <span className="ind-hero-stat-value">{s.value}</span>
                    <span className="ind-hero-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>

        {/* ════════ SHARE CARD ════════ */}
        <article className="ind-share-card">
          <header className="ind-card-head">
            <div className="ind-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </div>
            <div>
              <p className="ind-card-title">Seu Link &amp; Código Exclusivos</p>
              <p className="ind-card-sub">Compartilhe qualquer um: ambos identificam suas indicações</p>
            </div>
          </header>
          <PortalIndicarClient url={referralUrl} code={code} />
        </article>

        {/* ════════ COMO FUNCIONA ════════ */}
        <section className="ind-steps-card">
          <header className="ind-card-head">
            <div className="ind-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div>
              <p className="ind-card-title">Como Funciona</p>
              <p className="ind-card-sub">Três passos, renda recorrente automática</p>
            </div>
          </header>

          <div className="dash-grid">
            {STEPS.map((step) => (
              <div key={step.num} className="ind-step-card">
                <span className="ind-step-num">{step.num}</span>
                <h3 className="ind-step-title">{step.title}</h3>
                <p className="ind-step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════ POTENCIAL DE GANHOS ════════ */}
        <section className="ind-reward-card">
          <header className="ind-card-head">
            <div className="ind-card-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div>
              <p className="ind-card-title">Potencial de Ganhos</p>
              <p className="ind-card-sub">Sem teto: comissiona sobre toda a rede</p>
            </div>
          </header>

          <div className="dash-grid">
            {STATS.map((s) => (
              <div key={s.value} className="ind-reward-stat">
                <span className="ind-reward-value">{s.value}</span>
                <span className="ind-reward-label">{s.label}</span>
                <span className="ind-reward-sub">{s.sub}</span>
              </div>
            ))}
          </div>

          <p className="ind-reward-note">
            A comissão de rede indireta cresce <strong>+2% a cada nível de carreira</strong>{' '}
            atingido, chegando a <strong>8% ao alcançar o Diretor Geral</strong>. Quanto
            mais você avança na carreira, maior o retorno sobre toda a sua rede.
          </p>
        </section>

      </section>
    </div>
  );
}
