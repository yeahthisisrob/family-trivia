import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { apiService } from '../../../shared/api/ApiService';
import { fakeApi, openTabIn, renderWithServerData } from '../../../test/serverData';
import AllCelebrationsDialog from './AllCelebrationsDialog';

const celebration = (id: string, name: string, date: string) => ({
  id,
  type: 'other',
  name,
  date,
  addedBy: 'alice',
  addedAt: '2026-01-01T00:00:00.000Z',
  recurring: true,
});

describe('deleting a date', () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
    openTabIn('home');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('asks for the list again, so the deleted one is gone', async () => {
    let dates = [
      celebration('race', 'Springfield 5K', '05/15'),
      celebration('reunion', 'Reunion', '07/04'),
    ];
    const fetch = fakeApi({
      'GET /celebrations': () => ({ celebrations: dates, lastUpdated: '2026-01-01' }),
      'DELETE /celebrations': () => {
        dates = dates.filter((d) => d.id !== 'race');
        return { success: true };
      },
    });
    const view = renderWithServerData(
      <AllCelebrationsDialog open onClose={() => undefined} currentUserId="alice" />,
    );
    await vi.waitFor(() => expect(document.body.textContent).toContain('Springfield 5K'));

    const remove = document.body.querySelector('[data-testid="DeleteIcon"]')?.closest('button');
    await act(async () => remove?.click());

    await vi.waitFor(() => expect(document.body.textContent).not.toContain('Springfield 5K'));
    expect(document.body.textContent).toContain('Reunion');
    const reads = fetch.mock.calls.filter(([url, init]) => {
      return new URL(url).pathname === '/celebrations' && (init?.method ?? 'GET') === 'GET';
    });
    expect(reads).toHaveLength(2);
    view.unmount();
  });
});
