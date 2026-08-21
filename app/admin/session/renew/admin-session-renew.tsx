'use client';

import { useEffect, useState } from 'react';

type RefreshPayload = {
  expiresAt?: string;
};

export async function requestAdminSessionRefresh(
  csrfToken: string,
  signal?: AbortSignal
): Promise<Response> {
  const request = () =>
    fetch('/admin/session/refresh', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
      },
      body: '{}',
      signal,
    });

  // Multiple open admin tabs otherwise rotate the same token concurrently;
  // the losing request would correctly look like a replay. Web Locks makes
  // each fetch observe the cookie written by the preceding tab.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(
      'axeprime-admin-session-refresh',
      { mode: 'exclusive', ...(signal ? { signal } : {}) },
      request
    );
  }
  return request();
}

export default function AdminSessionRenew({
  csrfToken,
  nextPath,
}: {
  csrfToken: string;
  nextPath: string;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function renew() {
      try {
        const response = await requestAdminSessionRefresh(csrfToken, controller.signal);
        if (response.ok) {
          const payload = (await response.json()) as RefreshPayload;
          if (payload.expiresAt && Number.isFinite(Date.parse(payload.expiresAt))) {
            window.location.replace(nextPath);
            return;
          }
        }
        if (response.status === 401 || response.status === 403) {
          window.location.replace('/admin/login');
          return;
        }
        if (response.status === 409) {
          // A concurrent tab already rotated the credential. Give its
          // Set-Cookie response a moment to land, then let the proxy re-check.
          await new Promise(resolve => setTimeout(resolve, 250));
          if (!controller.signal.aborted) window.location.replace(nextPath);
          return;
        }
        if (response.status === 429) {
          setError('Muitas tentativas. Aguarde um instante e tente novamente.');
          return;
        }
        setError('Não foi possível renovar a sessão. Tente novamente.');
      } catch (requestError) {
        if ((requestError as Error).name !== 'AbortError') {
          setError('Falha de conexão ao renovar a sessão.');
        }
      }
    }

    void renew();
    return () => controller.abort();
  }, [csrfToken, nextPath]);

  return (
    <main className="adm-login-page">
      <section className="adm-login-card" aria-live="polite">
        <h1 className="adm-login-card-title">Renovando sessão</h1>
        <p className="adm-login-card-sub">
          Validando suas credenciais administrativas com segurança…
        </p>
        {error && (
          <div>
            <p className="adm-login-error" role="alert">
              {error}
            </p>
            <button
              type="button"
              className="adm-login-submit"
              onClick={() => window.location.reload()}
            >
              Tentar novamente
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
