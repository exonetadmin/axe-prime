import Image from 'next/image';
import { getAuthenticatedUser } from '@/lib/auth';
import { siteUrl } from '@/lib/site-content';
import { configRepository } from '@/src/features/admin/config.repository';
import PortalIndicarClient from './portal-indicar-client';

export const dynamic = 'force-dynamic';

export default async function PortalIndicarPage() {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const [commissionConfig, cashbackConfig] = await Promise.all([
    configRepository.getCommissionConfig(),
    configRepository.getCashbackConfig(),
  ]);
  const directPct = commissionConfig.direct_pct;
  const maximumNetworkPct =
    commissionConfig.level1_pct +
    commissionConfig.level2_pct +
    commissionConfig.level3_pct +
    commissionConfig.level4_pct;
  const formatPercentage = (value: number) =>
    `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
  const directPctLabel = formatPercentage(directPct);
  const maximumNetworkPctLabel = formatPercentage(maximumNetworkPct);
  const durationMonths = cashbackConfig.duration_months;
  const steps = [
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
      desc: `${directPctLabel} sobre o aporte mensal do indicado direto, creditado por até ${durationMonths} meses.`,
    },
  ];
  const stats = [
    { value: directPctLabel, label: 'sobre diretos', sub: 'por indicação direta' },
    { value: `${durationMonths}×`, label: 'meses pagos', sub: 'conforme a configuração' },
    { value: maximumNetworkPctLabel, label: 'rede indireta', sub: 'até Diretor Geral' },
  ];

  const code = (user.referralCode ?? '').trim();
  const referralUrl = code ? `${siteUrl}/auth?ref=${encodeURIComponent(code)}` : '';

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
                <span className="ind-hero-pct">{directPctLabel}</span>
                <span className="ind-hero-pct-suffix">a.m.</span>
              </div>
              <span className="ind-hero-pct-label">sobre cada aporte direto</span>
            </div>

            <div className="ind-hero-right">
              <p className="ind-hero-desc">
                Indique pessoas. Elas investem. Você ganha uma comissão mensal recorrente, sem
                limites de indicações e sem esforço adicional.
              </p>

              {/* Stats inline */}
              <div className="ind-hero-stats">
                {stats.map(s => (
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
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </div>
            <div>
              <p className="ind-card-title">Seu Link &amp; Código Exclusivos</p>
              <p className="ind-card-sub">
                Compartilhe qualquer um: ambos identificam suas indicações
              </p>
            </div>
          </header>
          <PortalIndicarClient url={referralUrl} code={code} />
        </article>

        {/* ════════ COMO FUNCIONA ════════ */}
        <section className="ind-steps-card">
          <header className="ind-card-head">
            <div className="ind-card-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <p className="ind-card-title">Como Funciona</p>
              <p className="ind-card-sub">Três passos, renda recorrente automática</p>
            </div>
          </header>

          <div className="dash-grid">
            {steps.map(step => (
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
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div>
              <p className="ind-card-title">Potencial de Ganhos</p>
              <p className="ind-card-sub">Sem teto: comissiona sobre toda a rede</p>
            </div>
          </header>

          <div className="dash-grid">
            {stats.map(s => (
              <div key={s.value} className="ind-reward-stat">
                <span className="ind-reward-value">{s.value}</span>
                <span className="ind-reward-label">{s.label}</span>
                <span className="ind-reward-sub">{s.sub}</span>
              </div>
            ))}
          </div>

          <p className="ind-reward-note">
            As quatro faixas de rede indireta seguem os percentuais configurados para N2 a N5,
            chegando hoje a <strong>{maximumNetworkPctLabel}</strong> para Diretor Geral. Quanto
            mais você avança na carreira, mais faixas são desbloqueadas.
          </p>
        </section>
      </section>
    </div>
  );
}
