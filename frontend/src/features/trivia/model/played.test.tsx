import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { useHighScores } from '../../../entities/high-scores';
import { useResults } from '../../../entities/leaderboard';
import { useTriviaProfile } from '../../../entities/person';
import { apiService } from '../../../shared/api/ApiService';
import { fakeApi, openTabIn, renderWithServerData } from '../../../test/serverData';
import { useAnswerGrid } from '../../who-has-played/model/grids';
import { usePlayedElsewhere, useTriviaAnswer } from './played';

let points = 3;
const routes = {
  'GET /answer-grid': () => ({ rows: [], dates: [], points }),
  'GET /consolidated-leaderboard': () => ({
    users: {
      alice: {
        leaderboardEntry: { userId: 'alice', score: points, streak: 1 },
        history: [],
        facts: [],
      },
    },
    groups: {},
    userGroups: {},
    seasons: [],
    success: true,
  }),
  'GET /user-profile': () => ({ history: [], categorySelections: [], totalScore: points }),
  'GET /games/scores': () => ({ game: 'curling', scores: [] }),
  'POST /submit-answer': () => {
    points = 5;
    return { correct: true, streak: 2, pointsEarned: 2 };
  },
};

const question = { question: 'Capital of France?', choices: ['Paris', 'Rome'], answer: 'Paris' };

let answer: () => Promise<unknown> = async () => undefined;
let elsewhere: (what: 'round' | 'answer') => void = () => undefined;

/** What the Trivia tab, the leaderboard and Profile show of alice. */
const Screens: React.FC = () => {
  const grid = useAnswerGrid('alice');
  const results = useResults('current');
  const profile = useTriviaProfile('alice');
  useHighScores('curling', true);
  const save = useTriviaAnswer();
  elsewhere = usePlayedElsewhere();
  answer = () =>
    save.mutateAsync({
      userId: 'alice',
      groupId: 'smiths',
      question,
      choice: 'Paris',
      catchingUp: false,
      isCustomCategory: false,
    });
  return (
    <p>
      grid {String((grid.data as { points?: number } | undefined)?.points)} board{' '}
      {results.data?.players[0]?.score} profile {profile.data?.totalScore}
    </p>
  );
};

const asked = (fetch: ReturnType<typeof fakeApi>, path: string) =>
  fetch.mock.calls.filter(([url]) => new URL(String(url)).pathname === path).length;

beforeEach(() => {
  localStorage.clear();
  apiService.clearCache();
  points = 3;
});
afterEach(() => vi.unstubAllGlobals());

describe('what playing trivia asks again', () => {
  test('a trivia answer: who has played, the leaderboard and the profile', async () => {
    const fetch = fakeApi(routes);
    openTabIn('home');
    const view = renderWithServerData(<Screens />);
    await vi.waitFor(() => expect(view.container.textContent).toBe('grid 3 board 3 profile 3'));

    await act(async () => {
      await answer();
    });
    await vi.waitFor(() => expect(view.container.textContent).toBe('grid 5 board 5 profile 5'));
    expect(asked(fetch, '/answer-grid')).toBe(2);
    expect(asked(fetch, '/consolidated-leaderboard')).toBe(2);
    expect(asked(fetch, '/user-profile')).toBe(2);
    // Saving an answer doesn't change any game's high scores.
    expect(asked(fetch, '/games/scores')).toBe(1);
    view.unmount();
  });

  test('only in the circle it was answered in', async () => {
    fakeApi(routes);
    openTabIn('crew');
    const crew = renderWithServerData(<Screens />);
    await vi.waitFor(() => expect(crew.container.textContent).toBe('grid 3 board 3 profile 3'));
    crew.unmount();
    openTabIn('home');
    const home = renderWithServerData(<Screens />, crew.client);
    await vi.waitFor(() => expect(home.container.textContent).toBe('grid 3 board 3 profile 3'));

    await act(async () => {
      await answer();
    });
    await vi.waitFor(() => expect(home.container.textContent).toBe('grid 5 board 5 profile 5'));
    const crewKeys = crew.client
      .getQueryCache()
      .getAll()
      .filter((q) => q.queryKey[1] === 'crew');
    expect(crewKeys.length).toBeGreaterThan(0);
    expect(crewKeys.every((q) => !q.state.isInvalidated)).toBe(true);
    home.unmount();
  });

  test('a round played: the same reads and the game boards', async () => {
    const fetch = fakeApi(routes);
    openTabIn('home');
    const view = renderWithServerData(<Screens />);
    await vi.waitFor(() => expect(view.container.textContent).toBe('grid 3 board 3 profile 3'));

    points = 4;
    await act(async () => elsewhere('round'));
    await vi.waitFor(() => expect(view.container.textContent).toBe('grid 4 board 4 profile 4'));
    await vi.waitFor(() => expect(asked(fetch, '/games/scores')).toBe(2));
    view.unmount();
  });
});
