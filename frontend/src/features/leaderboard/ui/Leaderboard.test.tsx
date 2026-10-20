import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { apiService } from '../../../shared/api/ApiService';
import { fakeApi, openTabIn, renderWithServerData } from '../../../test/serverData';
import Leaderboard from './Leaderboard';

const player = (userId: string, score: number) => ({
  leaderboardEntry: { userId, score, streak: 1 },
  history: [],
  facts: [],
});

const spring = {
  seasonNumber: 1,
  name: 'Spring',
  status: 'concluded',
  startDate: '2026-01-01',
  endDate: '2026-03-31',
};
const summer = {
  seasonNumber: 2,
  name: 'Summer',
  status: 'active',
  startDate: '2026-04-01',
  endDate: null,
};

/** The board as the API answers it, per circle and per season asked. */
const board = (circle: string | null, url: URL, players = [player(`${circle}-player`, 3)]) => {
  const season = url.searchParams.get('season');
  return {
    users: Object.fromEntries(players.map((p) => [p.leaderboardEntry.userId, p])),
    groups: {
      smiths: {
        groupId: 'smiths',
        totalScore: 3,
        memberCount: 1,
        topScorer: 'x',
        topScore: 3,
        averageScore: 3,
      },
    },
    userGroups: {},
    seasons: [spring, summer],
    ...(season === 'current'
      ? { selectedSeason: 2 }
      : season
        ? { selectedSeason: Number(season) }
        : {}),
    success: true,
  };
};

const asked = (fetch: ReturnType<typeof fakeApi>, path: string) =>
  fetch.mock.calls.map(([url]) => new URL(String(url))).filter((u) => u.pathname === path);

beforeEach(() => {
  localStorage.clear();
  apiService.clearCache();
});
afterEach(() => vi.unstubAllGlobals());

describe('the leaderboard', () => {
  test("two circles never share it (before: the crew's board showed in the family)", async () => {
    fakeApi({ 'GET /consolidated-leaderboard': (circle, url) => board(circle, url) });
    openTabIn('crew');
    const crew = renderWithServerData(<Leaderboard userId="alice" />);
    await vi.waitFor(() => expect(crew.container.textContent).toContain('crew-player'));
    crew.unmount();

    openTabIn('home');
    const home = renderWithServerData(<Leaderboard userId="alice" />, crew.client);
    await vi.waitFor(() => expect(home.container.textContent).toContain('home-player'));
    expect(home.container.textContent).not.toContain('crew-player');
    home.unmount();
  });

  test('opens on the current season in one request, with no request per player', async () => {
    const players = Array.from({ length: 30 }, (_, i) => player(`player-${i}`, 30 - i));
    const fetch = fakeApi({
      'GET /consolidated-leaderboard': (circle, url) => board(circle, url, players),
    });
    openTabIn('home');
    const view = renderWithServerData(<Leaderboard userId="alice" />);
    await vi.waitFor(() => expect(view.container.textContent).toContain('player-29'));

    const boards = asked(fetch, '/consolidated-leaderboard');
    expect(boards.map((u) => u.searchParams.get('season'))).toEqual(['current']);
    expect(asked(fetch, '/user-profile')).toHaveLength(0);
    expect(view.container.textContent).toContain('Summer');
    view.unmount();
  });

  test('keeps everyone the results carry, remembered and paused people too', async () => {
    // The API keeps them (#118); nothing here filters by who is playing now.
    const players = [player('alice', 9), player('grace-remembered', 5), player('bob-paused', 2)];
    fakeApi({ 'GET /consolidated-leaderboard': (circle, url) => board(circle, url, players) });
    openTabIn('home');
    const view = renderWithServerData(<Leaderboard userId="alice" />);
    await vi.waitFor(() => expect(view.container.textContent).toContain('bob-paused'));
    expect(view.container.textContent).toContain('grace-remembered');
    view.unmount();
  });

  test('the season picked is part of what is asked and cached', async () => {
    const fetch = fakeApi({ 'GET /consolidated-leaderboard': (circle, url) => board(circle, url) });
    openTabIn('home');
    const view = renderWithServerData(<Leaderboard userId="alice" />);
    await vi.waitFor(() => expect(view.container.textContent).toContain('Summer'));

    const picker = view.container.querySelector('[role="combobox"]') as HTMLElement;
    await act(async () => {
      picker.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    const springOption = [...document.querySelectorAll('[role="option"]')].find((o) =>
      o.textContent?.startsWith('Spring'),
    ) as HTMLElement;
    await act(async () => springOption.click());
    await vi.waitFor(() => expect(view.container.textContent).toContain('Spring'));

    expect(
      asked(fetch, '/consolidated-leaderboard').map((u) => u.searchParams.get('season')),
    ).toEqual(['current', '1']);
    const keys = view.client
      .getQueryCache()
      .getAll()
      .filter((q) => q.queryKey[2] === 'leaderboard')
      .map((q) => q.queryKey[4]);
    expect(keys).toEqual(['{"season":"current"}', '{"season":1}']);
    view.unmount();
  });
});
