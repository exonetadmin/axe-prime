'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

import {
  getPortalEntryProfile,
  getPortalEntryStageAt,
  getPortalEntryStages,
  type PortalEntryQuality,
  type PortalEntryStage,
} from '@/lib/portal-entry';

import styles from './portal-entry-sequence.module.css';

const PortalEntryFace = dynamic(() => import('@/components/portal-entry-face'), {
  ssr: false,
  loading: () => null,
});

type PortalEntrySequenceProps = {
  firstName: string;
  quality: PortalEntryQuality;
  onComplete: () => void;
};

const SKIP_ENABLED_AT_MS = 1600;
const LEAVE_MS = 360;

function getStageState(stage: PortalEntryStage, currentStage: PortalEntryStage, elapsedMs: number) {
  if (elapsedMs >= stage.endsAtMs) {
    return styles.stagePillDone;
  }

  if (stage.id === currentStage.id) {
    return styles.stagePillActive;
  }

  return '';
}

export default function PortalEntrySequence({
  quality,
  onComplete,
}: PortalEntrySequenceProps) {
  const profile = useMemo(() => getPortalEntryProfile(quality), [quality]);
  const stages = useMemo(() => getPortalEntryStages(profile.durationMs), [profile.durationMs]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [canSkip, setCanSkip] = useState(quality === 'skip');
  const [isLeaving, setIsLeaving] = useState(false);
  const [faceFailed, setFaceFailed] = useState(false);
  const completedRef = useRef(false);

  const currentStage = useMemo(
    () => getPortalEntryStageAt(elapsedMs, profile.durationMs),
    [elapsedMs, profile.durationMs],
  );

  const progress = profile.durationMs <= 0 ? 1 : Math.min(elapsedMs / profile.durationMs, 1);
  const finish = useCallback(
    (leaveMs = LEAVE_MS) => {
      if (completedRef.current) {
        return;
      }

      completedRef.current = true;
      setIsLeaving(true);
      window.setTimeout(() => {
        onComplete();
      }, leaveMs);
    },
    [onComplete],
  );

  useEffect(() => {
    document.body.classList.add('portal-entry-active');
    return () => {
      document.body.classList.remove('portal-entry-active');
    };
  }, []);

  useEffect(() => {
    if (quality === 'skip') {
      const timeoutId = window.setTimeout(() => finish(180), profile.durationMs);
      return () => window.clearTimeout(timeoutId);
    }

    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const nextElapsed = Math.min(now - start, profile.durationMs);
      setElapsedMs(nextElapsed);

      if (nextElapsed >= profile.durationMs) {
        finish();
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [finish, profile.durationMs, quality]);

  useEffect(() => {
    if (quality === 'skip') {
      return;
    }

    const timeoutId = window.setTimeout(() => setCanSkip(true), SKIP_ENABLED_AT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [quality]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && canSkip) {
        finish(180);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canSkip, finish]);

  return (
    <div className={`${styles.viewport} ${isLeaving ? styles.isLeaving : ''}`}>
      <div className={styles.backdrop} />

      <div className={styles.topBar}>
        <span className={styles.brand}>AXE PRIME</span>
        <button
          type="button"
          className={`${styles.skipButton} ${canSkip ? styles.skipButtonVisible : ''}`}
          onClick={() => finish(180)}
          disabled={!canSkip}
        >
          Pular abertura
        </button>
      </div>

      <div className={styles.stage}>
        <div className={styles.faceShell}>
          <div className={styles.faceHalo} />
          <div className={styles.faceViewport}>
            {quality === 'skip' || faceFailed ? (
              <div className={styles.faceFallback}>
                <div className={styles.fallbackCore} />
              </div>
            ) : (
              <PortalEntryFace quality={quality} progress={progress} onError={() => setFaceFailed(true)} />
            )}
          </div>
        </div>

        <div className={styles.bottomDock}>
          <div className={styles.stageRail} aria-label="Etapas da abertura do portal">
            {stages.map(stage => (
              <div
                key={stage.id}
                className={`${styles.stagePill} ${getStageState(stage, currentStage, elapsedMs)}`}
              >
                {stage.label}
              </div>
            ))}
          </div>

          <div className={styles.progressTrack} aria-hidden="true">
            <div
              className={styles.progressFill}
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
