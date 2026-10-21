import { CIRCLE_HEADER } from '@family-trivia/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { FamilyDataContext } from '../../../contexts/FamilyDataContext';
import { useResults } from '../../../entities/leaderboard';
import { apiService } from '../../../shared/api/ApiService';
import { fakeApi, openTabIn, refused, renderWithServerData } from '../../../test/serverData';
import { useAdminSeasons, useDeleteSeason, useUpdateSeason } from './seasons';

const season = (circle: string | null, name: string) => ({
  seasonNumber: 1,
  name: `${circle} ${name}`,
  status: 'active',
  startDate: '2026-03-01',
  endDate: null,
  message: null,
});

const board = (seasons: unknown[]) => ({
  users: {},
  groups: {},
  userGroups: {},
  seasons,
  success: true,
});

const asked = (fetch: ReturnType<typeof fakeApi>, method: string, path: string) =>
  fetch.mock.calls.filter(
    ([url, init]) => (init?.method ?? 'GET') === method && new URL(url).pathname === path,
  );
const circleOf = (call: [string, RequestInit?] | undefined) =>
  (call?.[1]?.headers as Record<string, string> | undefined)?.[CIRCLE_HEADER];

/** The admin's season list and the leaderboard's season list, on one screen. */
let change: (name: string) => Promise<unknown> = async () => undefined;
let remove: (n: number) => Promise<unknown> = async () => undefined;
const Seasons: React.FC = () => {
  const admin = useAdminSeasons();
  const results = useResults('current');
  const updating = useUpdateSeason();
  const deleting = useDeleteSeason();
  change = (name) => updating.mutateAsync({ seasonNumber: 1, name });
  remove = (n) => deleting.mutateAsync(n);
  return (
    <>
      <p id="admin">{admin.data?.seasons[0]?.name}</p>
      <p id="results">{results.data?.seasons[0]?.name}</p>
    </>
  );
};

describe('a season change', () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test("asks again for the leaderboard's seasons and Home's season status", async () => {
    let name = 'Spring';
    const fetch = fakeApi({
      'GET /admin/seasons': (circle) => ({
        currentSeasonNumber: 1,
        seasons: [season(circle, name)],
        success: true,
      }),
      'GET /consolidated-leaderboard': (circle) => board([season(circle, name)]),
      'PUT /admin/seasons': (_circle, _url, body) => {
        name = (body as { name: string }).name;
        return { success: true };
      },
    });
    const refreshInit = vi.fn(async () => undefined);
    openTabIn('home');
    const view = renderWithServerData(
      <FamilyDataContext.Provider value={{ refreshInit } as never}>
        <Seasons />
      </FamilyDataContext.Provider>,
    );
    const text = (id: string) => view.container.querySelector(`#${id}`)?.textContent;
    await vi.waitFor(() => expect(text('results')).toBe('home Spring'));
    await vi.waitFor(() => expect(text('admin')).toBe('home Spring'));

    await act(async () => {
      await change('Summer');
    });
    await vi.waitFor(() => expect(text('admin')).toBe('home Summer'));
    await vi.waitFor(() => expect(text('results')).toBe('home Summer'));
    expect(asked(fetch, 'GET', '/consolidated-leaderboard')).toHaveLength(2);
    expect(refreshInit).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  test('an admin of two circles sees and changes only the circle on screen', async () => {
    const fetch = fakeApi({
      'GET /admin/seasons': (circle) => ({
        currentSeasonNumber: 1,
        seasons: [season(circle, 'Spring')],
        success: true,
      }),
      'GET /consolidated-leaderboard': (circle) => board([season(circle, 'Spring')]),
      'PUT /admin/seasons': () => ({ success: true }),
    });
    openTabIn('crew');
    const crew = renderWithServerData(<Seasons />);
    await vi.waitFor(() =>
      expect(crew.container.querySelector('#admin')?.textContent).toBe('crew Spring'),
    );
    crew.unmount();

    openTabIn('home');
    const home = renderWithServerData(<Seasons />, crew.client);
    expect(home.container.querySelector('#admin')?.textContent).toBe('');
    await vi.waitFor(() =>
      expect(home.container.querySelector('#admin')?.textContent).toBe('home Spring'),
    );
    await act(async () => {
      await change('Summer');
    });
    expect(circleOf(asked(fetch, 'PUT', '/admin/seasons')[0])).toBe('home');
    const crewSeasons = crew.client
      .getQueryCache()
      .findAll({ queryKey: ['circle', 'crew', 'admin', 'seasons'] });
    expect(crewSeasons).toHaveLength(1);
    expect(crewSeasons[0]?.state.isInvalidated).toBe(false);
    home.unmount();
  });

  test('a delete the server turns down is sent once and changes nothing', async () => {
    const fetch = fakeApi({
      'GET /admin/seasons': (circle) => ({
        currentSeasonNumber: 1,
        seasons: [season(circle, 'Spring')],
        success: true,
      }),
      'DELETE /admin/seasons': () => refused(503, 'Busy'),
    });
    openTabIn('home');
    const view = renderWithServerData(<Seasons />);
    await vi.waitFor(() =>
      expect(view.container.querySelector('#admin')?.textContent).toBe('home Spring'),
    );
    await act(async () => {
      await expect(remove(1)).rejects.toThrow();
    });
    expect(asked(fetch, 'DELETE', '/admin/seasons')).toHaveLength(1);
    expect(asked(fetch, 'GET', '/admin/seasons')).toHaveLength(1);
    expect(view.container.querySelector('#admin')?.textContent).toBe('home Spring');
    view.unmount();
  });
});
