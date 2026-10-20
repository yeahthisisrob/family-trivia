import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import { act } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));
vi.mock('../../comments', () => ({ CommentsThread: () => null }));

// Two made-up games: one that saves a score when it's over, one without a board.
vi.mock('../../../games/registry', () => {
  const look = { gradient: 'none', accent: '#000' };
  const base = { description: '', badge: '', icon: SportsEsportsIcon, look };
  const Play = ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      Game over
    </button>
  );
  return {
    ARCADE: [
      { ...base, id: 'stacker', label: 'Stacker', Play },
      { ...base, id: 'sketch', label: 'Sketch', Play, scores: false },
    ],
  };
});

import { apiService } from '../../../shared/api/ApiService';
import { fakeApi, openTabIn, renderWithServerData } from '../../../test/serverData';
import ArcadePage from './ArcadePage';

let best = 100;
const routes = {
  'GET /games/scores': (_circle: string | null, url: URL) => ({
    game: url.searchParams.get('game'),
    scores: [{ userId: 'alice', score: best, date: '2026-10-01T12:00:00.000Z', mode: 'arcade' }],
  }),
};

const asked = (fetch: ReturnType<typeof fakeApi>) =>
  fetch.mock.calls
    .map(([url]) => new URL(String(url)))
    .filter((u) => u.pathname === '/games/scores')
    .map((u) => u.searchParams.get('game'));

const click = (view: { container: HTMLElement }, text: string) =>
  act(async () => {
    const button = [...view.container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes(text),
    );
    button?.click();
  });

beforeEach(() => {
  localStorage.clear();
  apiService.clearCache();
  best = 100;
});
afterEach(() => vi.unstubAllGlobals());

test('opening the Arcade asks for the board on screen only', async () => {
  const fetch = fakeApi(routes);
  openTabIn('home');
  const view = renderWithServerData(<ArcadePage userId="alice" />);
  await vi.waitFor(() => expect(view.container.textContent).toContain('100'));
  expect(asked(fetch)).toEqual(['stacker']);
  view.unmount();
});

test('after a game, its board is asked again', async () => {
  const fetch = fakeApi(routes);
  openTabIn('home');
  const view = renderWithServerData(<ArcadePage userId="alice" />);
  await vi.waitFor(() => expect(view.container.textContent).toContain('100'));

  await click(view, 'Play Stacker');
  await vi.waitFor(() => expect(view.container.textContent).toContain('Game over'));
  best = 250;
  await click(view, 'Game over');
  await vi.waitFor(() => expect(view.container.textContent).toContain('250'));
  expect(asked(fetch)).toEqual(['stacker', 'stacker']);
  view.unmount();
});
