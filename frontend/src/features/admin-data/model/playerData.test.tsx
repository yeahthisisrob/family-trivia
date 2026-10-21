import { CIRCLE_HEADER } from '@family-trivia/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { useResults } from '../../../entities/leaderboard';
import { useTriviaProfile } from '../../../entities/person';
import { apiService } from '../../../shared/api/ApiService';
import { fakeApi, openTabIn, refused, renderWithServerData } from '../../../test/serverData';
import {
  useDeleteFact,
  useDeleteTrivia,
  useEditFact,
  useFeudChange,
  usePlayerFacts,
  usePlayerTrivia,
} from './playerData';

const fact = (circle: string | null, answer: string) => ({
  timestamp: '2026-10-12T09:00:00.000Z',
  key: 'shared__2026-10-12',
  date: '2026-10-12',
  question: 'Best pie?',
  answer: `${circle} ${answer}`,
  answered: true,
  skipped: false,
  questionType: 'shared',
});

const board = { users: {}, groups: {}, userGroups: {}, seasons: [], success: true };

const asked = (fetch: ReturnType<typeof fakeApi>, method: string, path: string) =>
  fetch.mock.calls.filter(
    ([url, init]) => (init?.method ?? 'GET') === method && new URL(url).pathname === path,
  );
const circleOf = (call: [string, RequestInit?] | undefined) =>
  (call?.[1]?.headers as Record<string, string> | undefined)?.[CIRCLE_HEADER];

/** Bob's facts and trivia as an admin sees them, beside his profile and the results. */
let edit: (answer: string) => Promise<unknown> = async () => undefined;
let removeFact: () => Promise<unknown> = async () => undefined;
let removeTrivia: () => Promise<unknown> = async () => undefined;
let resetFeud: () => Promise<unknown> = async () => undefined;
const PlayerData: React.FC = () => {
  const facts = usePlayerFacts('bob');
  const trivia = usePlayerTrivia('bob');
  useTriviaProfile('bob');
  useResults('current');
  const editing = useEditFact();
  const deletingFact = useDeleteFact();
  const deletingTrivia = useDeleteTrivia();
  const changingFeud = useFeudChange();
  const at = { userId: 'bob', timestamp: '2026-10-12T09:00:00.000Z' };
  edit = (answer) => editing.mutateAsync({ ...at, answer });
  removeFact = () => deletingFact.mutateAsync(at);
  removeTrivia = () => deletingTrivia.mutateAsync(at);
  resetFeud = () => changingFeud.mutateAsync({ action: 'reset-current' });
  return (
    <p>
      {facts.data?.[0]?.answer}, {trivia.data?.length ?? 0} answers
    </p>
  );
};

const routes = (answer: () => string) => ({
  'GET /admin/user-facts': (circle: string | null) => ({
    facts: [fact(circle, answer())],
    success: true,
  }),
  'GET /admin/user-trivia': () => ({ history: [], success: true }),
  'GET /user-profile': () => ({}),
  'GET /consolidated-leaderboard': () => board,
});

describe("Player Data's changes", () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test('each asks again for what it changed, and only that', async () => {
    let answer = 'Apple';
    const fetch = fakeApi({
      ...routes(() => answer),
      'PUT /admin/user-facts': (_circle, _url, body) => {
        answer = (body as { answer: string }).answer;
        return { success: true };
      },
      'DELETE /admin/user-facts': () => ({ success: true, removed: 1 }),
      'DELETE /admin/user-trivia': () => ({ success: true, removedCount: 1 }),
      'DELETE /admin/family-feud': () => ({ success: true, action: 'reset-current' }),
    });
    openTabIn('home');
    const view = renderWithServerData(<PlayerData />);
    await vi.waitFor(() => expect(view.container.textContent).toBe('home Apple, 0 answers'));
    const gets = (path: string) => asked(fetch, 'GET', path).length;

    // A fact shows in their profile, not in the results.
    await act(async () => {
      await edit('Cherry');
    });
    await vi.waitFor(() => expect(view.container.textContent).toBe('home Cherry, 0 answers'));
    expect([gets('/admin/user-facts'), gets('/user-profile')]).toEqual([2, 2]);
    expect([gets('/admin/user-trivia'), gets('/consolidated-leaderboard')]).toEqual([1, 1]);

    await act(async () => {
      await removeFact();
    });
    expect([gets('/admin/user-facts'), gets('/user-profile')]).toEqual([3, 3]);

    // A trivia answer shows in their profile and the results.
    await act(async () => {
      await removeTrivia();
    });
    expect([gets('/admin/user-trivia'), gets('/user-profile')]).toEqual([2, 4]);
    expect([gets('/consolidated-leaderboard'), gets('/admin/user-facts')]).toEqual([2, 3]);

    // A Feud round's points show in the results.
    await act(async () => {
      await resetFeud();
    });
    expect([gets('/consolidated-leaderboard'), gets('/user-profile')]).toEqual([3, 4]);
    view.unmount();
  });

  test('an admin of two circles sees and changes only the circle on screen', async () => {
    const fetch = fakeApi({
      ...routes(() => 'Apple'),
      'PUT /admin/user-facts': () => ({ success: true }),
    });
    openTabIn('crew');
    const crew = renderWithServerData(<PlayerData />);
    await vi.waitFor(() => expect(crew.container.textContent).toBe('crew Apple, 0 answers'));
    crew.unmount();

    openTabIn('home');
    const home = renderWithServerData(<PlayerData />, crew.client);
    expect(home.container.textContent).toBe(', 0 answers');
    await vi.waitFor(() => expect(home.container.textContent).toBe('home Apple, 0 answers'));
    await act(async () => {
      await edit('Cherry');
    });
    expect(circleOf(asked(fetch, 'PUT', '/admin/user-facts')[0])).toBe('home');
    const crewFacts = crew.client
      .getQueryCache()
      .findAll({ queryKey: ['circle', 'crew', 'admin', 'player-data'] });
    expect(crewFacts).toHaveLength(2);
    expect(crewFacts.every((q) => !q.state.isInvalidated)).toBe(true);
    home.unmount();
  });

  test('a delete the server turns down is sent once and changes nothing', async () => {
    const fetch = fakeApi({
      ...routes(() => 'Apple'),
      'DELETE /admin/user-facts': () => refused(503, 'Busy'),
    });
    openTabIn('home');
    const view = renderWithServerData(<PlayerData />);
    await vi.waitFor(() => expect(view.container.textContent).toBe('home Apple, 0 answers'));
    await act(async () => {
      await expect(removeFact()).rejects.toThrow();
    });
    expect(asked(fetch, 'DELETE', '/admin/user-facts')).toHaveLength(1);
    expect(asked(fetch, 'GET', '/admin/user-facts')).toHaveLength(1);
    expect(view.container.textContent).toBe('home Apple, 0 answers');
    view.unmount();
  });
});
