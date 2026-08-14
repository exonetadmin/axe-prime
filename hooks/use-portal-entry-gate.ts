'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  consumePortalEntryIntent,
  readPortalEntryIntent,
  resolvePortalEntryQuality,
  type PortalEntryQuality,
} from '@/lib/portal-entry';

type NavigatorWithHints = Navigator & {
  connection?: {
    saveData?: boolean;
  };
  deviceMemory?: number;
};

type PortalEntryGateState = {
  ready: boolean;
  shouldShow: boolean;
  quality: PortalEntryQuality;
};

function hasWebGLSupport(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl'),
    );
  } catch {
    return false;
  }
}

export function usePortalEntryGate() {
  const [state, setState] = useState<PortalEntryGateState>({
    ready: false,
    shouldShow: false,
    quality: 'skip',
  });

  useEffect(() => {
    const intent = readPortalEntryIntent();
    const nextState: PortalEntryGateState = !intent
      ? {
          ready: true,
          shouldShow: false,
          quality: 'skip',
        }
      : {
          ready: true,
          shouldShow: true,
          quality: resolvePortalEntryQuality({
            viewportWidth: window.innerWidth,
            prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            saveData: (navigator as NavigatorWithHints).connection?.saveData ?? false,
            deviceMemory: (navigator as NavigatorWithHints).deviceMemory,
            hasWebGL: hasWebGLSupport(),
          }),
        };

    const frameId = window.requestAnimationFrame(() => {
      setState(nextState);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const dismiss = useCallback(() => {
    setState(current => ({
      ...current,
      shouldShow: false,
    }));
  }, []);

  const consume = useCallback(() => {
    consumePortalEntryIntent();
  }, []);

  return {
    ...state,
    consume,
    dismiss,
  };
}
