/**
 * The Slot Machine moved into its folder without moving its data: the same
 * keys, the same paths (the installed app may still call them).
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
}));
vi.mock('../categories', () => ({
  getAvailableCategories: vi.fn().mockResolvedValue(['Science & Nature']),
}));

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { invalidateGameModeCache } from '../../../services/gameModeService';
import { podiumGames, serverGame } from '../../../services/gameRegistry';
import { invalidatePlayerStateCache } from '../../../services/playerStateService';
import { invalidateSeasonsCache } from '../../../services/seasonService';
import {
  getHistory,
  listStored,
  resetS3Mock,
  seedDefaultActiveSeason,
  seedHistory,
} from '../../../tests/helpers/s3Mock';
import { routesOf } from '../kit';
import '../routes';
import slotMachine from '.';
import { keys, STORAGE } from './keys';

const ev = (body: unknown) =>
  ({ body: JSON.stringify(body), queryStringParameters: null }) as unknown as APIGatewayProxyEvent;
const routes = routesOf(slotMachine);
const call = (route: string, body: unknown) => routes[route]!(ev(body), 'alice', {} as never);

beforeEach(() => {
  resetS3Mock();
  invalidatePlayerStateCache();
  invalidateSeasonsCache();
  invalidateGameModeCache();
});

test('the keys are the strings they have always been', () => {
  expect(STORAGE).toBe('slot-machine/');
  expect(keys.session('alice')).toBe('slot-machine/alice/session.json');
  expect(keys.stats('alice')).toBe('slot-machine/alice/stats.json');
  expect(keys.finished('alice', 1700000000000, true)).toBe(
    'slot-machine/alice/sessions/1700000000000_won.json',
  );
  expect(keys.finished('alice', 1700000000000, false)).toBe(
    'slot-machine/alice/sessions/1700000000000_lost.json',
  );
});

test('the routes are served at the paths they have always had', () => {
  expect(Object.keys(routes).sort()).toEqual([
    'GET /slot-machine/balance',
    'GET /slot-machine/status',
    'POST /slot-machine/answer',
    'POST /slot-machine/arcade-spin',
    'POST /slot-machine/question',
    'POST /slot-machine/spin',
  ]);
});

test('a play is kept at the same keys and ends in the answer history, as before', async () => {
  seedDefaultActiveSeason();
  seedHistory('alice', []);
  expect((await call('POST /slot-machine/spin', { userId: 'alice' })).statusCode).toBe(200);
  expect(listStored('slot-machine/')).toEqual(['slot-machine/alice/session.json']);
  expect((await call('POST /slot-machine/question', { userId: 'alice' })).statusCode).toBe(200);
  expect(
    (await call('POST /slot-machine/answer', { userId: 'alice', answer: 'Saturn' })).statusCode,
  ).toBe(200);
  expect(listStored('slot-machine/').sort()).toEqual([
    'slot-machine/alice/session.json',
    expect.stringMatching(/^slot-machine\/alice\/sessions\/\d+_won\.json$/),
    'slot-machine/alice/stats.json',
  ]);
  expect(getHistory('alice')[0]).toMatchObject({ isSlotMachine: true, correct: true });
});

test('its board earns podium points, with the same boards as before', () => {
  expect(serverGame('slot-machine')?.storage).toBe('slot-machine/');
  expect(podiumGames().sort()).toEqual(['curling', 'slot-machine', 'tetris']);
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
