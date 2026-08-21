'use client';

const CSRF_COOKIE = 'axeprime_csrf_token';
let refreshInFlight: Promise<boolean> | null = null;
const REFRESH_LOCK_NAME = 'axeprime:user-session-refresh';
const CONCURRENT_REFRESH_RECHECK_BACKOFF_MS = [0, 250, 500, 750] as const;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  for (const entry of document.cookie.split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0 || entry.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(entry.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

function securedHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  const method = (init?.method ?? 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers.set('x-csrf-token', csrf);
  }
  return headers;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function hasCurrentAccessSession(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    return response.ok;
  } catch {
    return false;
  }
}

function retryAfterMilliseconds(response: Response): number {
  const seconds = Number(response.headers.get('retry-after'));
  if (!Number.isFinite(seconds) || seconds <= 0) return 250;
  return Math.min(1_000, Math.max(100, Math.ceil(seconds * 1_000)));
}

async function sessionWasRefreshedInAnotherTab(response: Response): Promise<boolean> {
  // A 409 means PostgreSQL observed this refresh credential immediately after
  // another request rotated it. Respect Retry-After, then poll briefly because
  // the winning response may still be signing its JWT or publishing cookies.
  const retryAfter = retryAfterMilliseconds(response);
  for (const backoff of CONCURRENT_REFRESH_RECHECK_BACKOFF_MS) {
    await wait(backoff === 0 ? retryAfter : backoff);
    if (await hasCurrentAccessSession()) return true;
  }
  return false;
}

async function requestRefresh(): Promise<boolean> {
  const csrf = readCookie(CSRF_COOKIE);
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrf ? { 'x-csrf-token': csrf } : undefined,
  });
  if (response.status === 409) return sessionWasRefreshedInAnotherTab(response);
  return response.ok;
}

async function refreshWithCrossTabCoordination(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.locks) return requestRefresh();
  return navigator.locks.request(REFRESH_LOCK_NAME, { mode: 'exclusive' }, async () => {
    // Another tab may have refreshed while this one waited for the lock. Cookie
    // updates are visible browser-wide before the winning fetch releases it.
    if (await hasCurrentAccessSession()) return true;
    return requestRefresh();
  });
}

function refreshSessionOnce(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshWithCrossTabCoordination().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** Same-origin API client with CSRF propagation and one transparent refresh. */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const requestInit: RequestInit = {
    ...init,
    credentials: 'same-origin',
    headers: securedHeaders(init),
  };
  let response = await fetch(input, requestInit);
  if (response.status !== 401) return response;

  if (!(await refreshSessionOnce())) return response;
  response = await fetch(input, {
    ...requestInit,
    headers: securedHeaders(init),
  });
  return response;
}
