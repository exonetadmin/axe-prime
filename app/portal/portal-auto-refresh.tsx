'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Auto-refresh do portal a cada `intervalMs` milissegundos.
 * Usa router.refresh() — re-busca dados dos Server Components
 * sem recarregar a página inteira (sem flash branco).
 *
 * Pausa polling quando a aba está oculta (Page Visibility API).
 */
const POLL_INTERVAL_MS = 30_000; // 30 segundos

export default function PortalAutoRefresh() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function startPolling() {
      if (timerRef.current) return;
      timerRef.current = setInterval(() => {
        router.refresh();
      }, POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    function handleVisibility() {
      if (document.hidden) {
        stopPolling();
      } else {
        // Refresh imediato ao voltar + reinicia timer
        router.refresh();
        startPolling();
      }
    }

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [router]);

  // Componente invisível — não renderiza nada
  return null;
}
