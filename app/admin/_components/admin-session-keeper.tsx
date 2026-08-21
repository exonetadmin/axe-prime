'use client';

import { useEffect } from 'react';
import { requestAdminSessionRefresh } from '../session/renew/admin-session-renew';

const REFRESH_MARGIN_MS = 60_000;
const TRANSIENT_RETRY_MS = 15_000;

export default function AdminSessionKeeper({
  csrfToken,
  accessTokenExpiresAt,
}: {
  csrfToken: string;
  accessTokenExpiresAt: number;
}) {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let activeRequest: AbortController | undefined;

    const scheduleAt = (expiresAt: number) => {
      if (cancelled) return;
      const delay = Math.max(250, expiresAt - Date.now() - REFRESH_MARGIN_MS);
      timer = setTimeout(() => void renew(), delay);
    };

    const scheduleRetry = (delay: number) => {
      if (cancelled) return;
      timer = setTimeout(() => void renew(), Math.max(1_000, delay));
    };

    const renew = async () => {
      activeRequest = new AbortController();
      try {
        const response = await requestAdminSessionRefresh(csrfToken, activeRequest.signal);
        if (response.ok) {
          const payload = (await response.json()) as { expiresAt?: string };
          const expiresAt = Date.parse(payload.expiresAt ?? '');
          if (Number.isFinite(expiresAt)) {
            scheduleAt(expiresAt);
            return;
          }
        }

        if (response.status === 401 || response.status === 403) {
          window.location.replace('/admin/login');
          return;
        }
        if (response.status === 409) {
          // Another tab won the rotation. Reloading obtains its access cookie
          // without rotating the replacement token a second time.
          timer = setTimeout(() => window.location.reload(), 250);
          return;
        }
        if (response.status === 429) {
          const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
          scheduleRetry(Number.isSafeInteger(retryAfter) ? retryAfter * 1_000 : TRANSIENT_RETRY_MS);
          return;
        }
        scheduleRetry(TRANSIENT_RETRY_MS);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          scheduleRetry(TRANSIENT_RETRY_MS);
        }
      }
    };

    scheduleAt(accessTokenExpiresAt);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      activeRequest?.abort();
    };
  }, [accessTokenExpiresAt, csrfToken]);

  return null;
}
