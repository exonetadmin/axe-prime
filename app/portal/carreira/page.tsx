import { redirect } from 'next/navigation';

import { getAuthenticatedUser } from '@/lib/auth';
import { networkService } from '@/src/features/network';
import {
  CAREER_UNLOCK_LEVELS,
  POSITION_LEVELS,
  type PositionLevel,
} from '@/src/features/network/network.contract';

export const dynamic = 'force-dynamic';

const CAREER_ORDER: PositionLevel[] = [
  'vendedor_elite',
  'supervisor',
  'gestor',
  'gerente_senior',
  'diretor_geral',
];

export default async function CareerPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect('/auth');

  const position = await networkService.getPosition(user.id);
  const currentIndex = CAREER_ORDER.indexOf(position.level);
  const progress = position.progress;
  const progressPercent = progress
    ? Math.min(100, Math.round((progress.current / Math.max(1, progress.required)) * 100))
    : 100;

  return (
    <div className="portal-page">
      <section className="portal-shell pcareer-root">
        <header className="portal-welcome-banner pcareer-hero">
          <div>
            <p className="portal-kicker">Plano de carreira</p>
            <h1 className="portal-title">Sua evolução na AXE PRIME</h1>
            <p className="portal-welcome-copy">
              Acompanhe sua posição, os critérios da próxima etapa e as faixas de remuneração
              liberadas pela sua liderança.
            </p>
          </div>
          <div className="pcareer-current-badge">
            <span>Posição atual</span>
            <strong>{position.label}</strong>
          </div>
        </header>

        <article className="portal-card pcareer-progress-card">
          <div className="pcareer-progress-copy">
            <span className="portal-kicker">Próximo objetivo</span>
            <h2>{position.requirement}</h2>
            <p>
              {progress
                ? `${progress.current} de ${progress.required} requisitos contabilizados.`
                : 'Você alcançou a etapa mais alta da trilha.'}
            </p>
          </div>
          <div className="pcareer-progress-metric" aria-label={`${progressPercent}% concluído`}>
            <strong>{progressPercent}%</strong>
            <span>progresso</span>
          </div>
          <div className="pcareer-progress-track" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
        </article>

        <div className="pcareer-ladder" aria-label="Etapas do plano de carreira">
          {CAREER_ORDER.map((level, index) => {
            const meta = POSITION_LEVELS[level];
            const isCurrent = level === position.level;
            const isReached = index <= currentIndex;
            const className = [
              'pcareer-level',
              isCurrent ? 'is-current' : '',
              isReached ? 'is-reached' : 'is-locked',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <article className={className} key={level}>
                <div className="pcareer-level-head">
                  <span className="pcareer-level-number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="pcareer-level-state">
                    {isCurrent ? 'Atual' : isReached ? 'Concluída' : 'Próxima'}
                  </span>
                </div>
                <h2>{meta.label}</h2>
                <p>{meta.requirement}</p>
                <div className="pcareer-level-unlock">
                  <span>Faixas liberadas</span>
                  <strong>N1–N{CAREER_UNLOCK_LEVELS[level]}</strong>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
