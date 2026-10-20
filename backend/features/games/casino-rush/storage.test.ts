/**
 * Casino Rush moved into its folder without moving its data: the same keys,
 * the same paths (the installed app may still call them).
 */
vi.mock(
  '../../../services/s3',
  async () => (await import('../../../tests/helpers/s3Mock')).s3MockModule,
);
vi.mock('../../../routes/questionGeneration/shared', () => ({
  generateQuestionWithOptions: vi.fn().mockResolvedValue({
    question: {
      question: 'Which planet has rings?',
      choices: ['Saturn', 'Mars', 'Venus', 'Mercury'],
      answer: 'Saturn',
      category: 'Science & Nature',
      difficulty: 'normal',
    },
    messages: [],
  }),
  validateGeneratedQuestion: vi.fn().mockReturnValue(true),
}));
vi.mock('../categories', () => ({
  getAvailableCategories: vi.fn().mockResolvedValue(['Science & Nature']),
}));

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { invalidateGameModeCache } from '../../../services/gameModeService';
import { serverGame } from '../../../services/gameRegistry';
import { invalidatePlayerStateCache } from '../../../services/playerStateService';
import { invalidateSeasonsCache } from '../../../services/seasonService';
import {
  getHistory,
  getStored,
  listStored,
  resetS3Mock,
  seedDefaultActiveSeason,
  seedHistory,
  seedRaw,
} from '../../../tests/helpers/s3Mock';
import { routesOf } from '../kit';
import '../routes';
import casinoRush from '.';
import { keys, STORAGE } from './keys';

const ev = (body: unknown, query: Record<string, string> | null = null) =>
  ({ body: JSON.stringify(body), queryStringParameters: query }) as unknown as APIGatewayProxyEvent;
const routes = routesOf(casinoRush);

beforeEach(() => {
  resetS3Mock();
  invalidatePlayerStateCache();
  invalidateSeasonsCache();
  invalidateGameModeCache();
});

test('the keys are the strings they have always been', () => {
  expect(STORAGE).toBe('casino-rush/');
  expect(keys.current('alice')).toBe('casino-rush/alice/current-session.json');
  expect(keys.legacy('alice')).toBe('casino-rush/alice/session.json');
  expect(keys.sessions('alice')).toBe('casino-rush/alice/sessions/');
  expect(keys.history('alice')).toBe('casino-rush/alice/history.json');
});

test('the routes are served at the paths they have always had', () => {
  expect(Object.keys(routes).sort()).toEqual([
    'GET /casino-rush/status',
    'POST /casino-rush/answer',
    'POST /casino-rush/start',
  ]);
});

test('a play is kept at the same key and ends in the answer history, as before', async () => {
  seedDefaultActiveSeason();
  seedHistory('alice', []);
  const start = await routes['POST /casino-rush/start']!(
    ev({ userId: 'alice' }),
    'alice',
    {} as never,
  );
  expect(start.statusCode).toBe(200);
  expect(listStored('casino-rush/')).toEqual(['casino-rush/alice/current-session.json']);
  expect(getStored<{ status: string }>('casino-rush/alice/current-session.json')?.status).toBe(
    'active',
  );

  for (let i = 0; i < 3; i++)
    await routes['POST /casino-rush/answer']!(
      ev({ userId: 'alice', answer: 'Saturn' }),
      'alice',
      {} as never,
    );
  expect(listStored('casino-rush/')).toEqual([]);
  const history = getHistory('alice');
  expect(history).toHaveLength(3);
  expect(history[0]).toMatchObject({ isCasinoRush: true, casinoSessionId: expect.any(String) });
});

test('admin and the archive find its files through its declared prefix', async () => {
  seedRaw('casino-rush/bob/current-session.json', {
    userId: 'bob',
    startTime: 1,
    status: 'active',
    questions: [],
    currentQuestionIndex: 0,
    difficulty: 'normal',
    potentialPoints: 3,
  });
  seedRaw('casino-rush/bob/history.json', { lastPlayedAt: 1 });
  const game = serverGame('casino-rush');
  expect(game?.storage).toBe('casino-rush/');
  expect(await game?.admin?.open()).toEqual([expect.objectContaining({ userId: 'bob' })]);
  expect(await game?.admin?.reset('bob')).toEqual([
    'casino-rush/current-session',
    'casino-rush/history',
  ]);
  expect(listStored('casino-rush/')).toEqual([]);
});

test('the API still answers at those paths (the router finds them, then asks for sign-in)', async () => {
  const { handler } = await import('../../../index');
  for (const route of Object.keys(routes)) {
    const [httpMethod, path] = route.split(' ');
    const event = { httpMethod, path: `/api${path}`, headers: {}, body: null };
    const res = await handler(event as never, {} as never, () => undefined);
    expect(res?.statusCode, route).toBe(401);
  }
});
