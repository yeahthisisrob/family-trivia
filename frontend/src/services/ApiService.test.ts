import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { ApiError, apiService } from './ApiService';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('ApiService when the server is busy or down', () => {
  beforeEach(() => {
    apiService.clearCache();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test('a request turned away (503) is tried again, and gets its answer', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(503, { message: 'Service Unavailable' }))
      .mockResolvedValueOnce(json(200, { ok: true, data: { days: [] } }));
    vi.stubGlobal('fetch', fetch);
    await expect(apiService.request('/plans')).resolves.toEqual({ days: [] });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('still failing: an honest error, never an empty stand-in that looks like an answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json(503, { message: 'Service Unavailable' })),
    );
    await expect(apiService.request('/teams')).rejects.toBeInstanceOf(ApiError);
    // Asked again at once: paused, and still an error rather than {}.
    await expect(apiService.request('/teams')).rejects.toMatchObject({ errorType: 'UNAVAILABLE' });
  });

  test('a failure pauses that request only briefly', async () => {
    const fetch = vi.fn().mockResolvedValue(json(503, {}));
    vi.stubGlobal('fetch', fetch);
    await expect(apiService.request('/family')).rejects.toBeInstanceOf(ApiError);
    fetch.mockResolvedValue(json(200, { ok: true, data: { people: [] } }));
    vi.advanceTimersByTime(20_000);
    await expect(apiService.request('/family')).resolves.toEqual({ people: [] });
  });
});
