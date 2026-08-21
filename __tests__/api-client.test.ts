import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('revalidates shared cookies and retries after another tab rotates the refresh token', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 409, headers: { 'Retry-After': '1' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch } = await import('../lib/api-client');
    const pending = apiFetch('/api/v1/profile');
    await vi.runAllTimersAsync();
    const response = await pending;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[1]).toEqual([
      '/api/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    ]);
    expect(fetchMock.mock.calls[2]).toEqual([
      '/api/auth/session',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    ]);
    expect(fetchMock.mock.calls[3]?.[0]).toBe('/api/v1/profile');
  });

  it('keeps the original unauthorized response when the shared session is not valid', async () => {
    const initialResponse = new Response(null, { status: 401 });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(initialResponse)
      .mockResolvedValueOnce(new Response(null, { status: 409 }))
      .mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const { apiFetch } = await import('../lib/api-client');
    const pending = apiFetch('/api/v1/profile');
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toBe(initialResponse);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
