'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api-client';

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
    async function refreshPortal() {
      const response = await apiFetch('/api/auth/session', {
        cache: 'no-store',
      }).catch(() => null);
      if (!response?.ok) {
        router.replace('/auth');
        return;
      }
      router.refresh();
    }

    function startPolling() {
      if (timerRef.current) return;
      timerRef.current = setInterval(() => {
        void refreshPortal();
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
        void refreshPortal();
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
