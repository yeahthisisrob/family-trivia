// The leaderboard's read, held to its contract entry by the shared setup
// (0034): the frontend types it from it (0035). `season=current` opens on the
// season the leaderboard shows first, in one request.
vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getConsolidatedLeaderboard } from '../routes/consolidatedLeaderboard';
import { invalidateSeasonsCache } from '../services/seasonService';
import { invalidateUserConfigCache } from '../services/users';
import { resetS3Mock, seedRaw, seedSeasons } from './helpers/s3Mock';

const answer = (day: string, correct: boolean, difficulty: 'easy' | 'normal' | 'hard') => ({
  timestamp: `${day}T12:00:00.000Z`,
  correct,
  selectedAnswer: 'A',
  pointsEarned: correct ? 2 : 0,
  question: {
    question: `Q on ${day}`,
    choices: ['A', 'B', 'C', 'D'],
    answer: 'A',
    category: 'History',
    difficulty,
  },
});

const asks = (query: Record<string, string> = {}) =>
  ({ httpMethod: 'GET', queryStringParameters: query }) as unknown as APIGatewayProxyEvent;

const read = async (query: Record<string, string> = {}) => {
  const r = await getConsolidatedLeaderboard(asks(query));
  return { status: r.statusCode, data: JSON.parse(r.body).data };
};

const spring = {
  seasonNumber: 1,
  name: 'Spring',
  status: 'concluded' as const,
  startDate: '2026-01-01',
  endDate: '2026-03-31',
  message: null,
};
const summer = {
  seasonNumber: 2,
  name: 'Summer',
  status: 'active' as const,
  startDate: '2026-04-01',
  endDate: null,
  message: null,
};

beforeEach(() => {
  resetS3Mock();
  invalidateUserConfigCache();
  invalidateSeasonsCache();
  seedRaw('config/users.json', {
    version: '1',
    lastUpdated: '2026-01-01',
    users: { alice: { group: 'smiths' }, bob: { group: 'smiths' }, carol: { group: 'joneses' } },
  });
  seedRaw('config/group_descriptions.json', {
    smiths: { description: 'The Springfield side', lastUpdated: '2026-01-02', updatedBy: 'alice' },
  });
  seedRaw('answers/history/alice.json', [
    answer('2026-02-01', true, 'hard'),
    answer('2026-05-01', true, 'easy'),
  ]);
  seedRaw('answers/history/bob.json', [answer('2026-05-02', false, 'normal')]);
  seedRaw('answers/history/carol.json', [answer('2026-02-03', true, 'normal')]);
});

test('every player, their history, the groups and the seasons', async () => {
  seedSeasons({ currentSeasonNumber: 2, seasons: [spring, summer] });
  const { status, data } = await read();
  expect(status).toBe(200);
  expect(data.selectedSeason).toBeUndefined();
  expect(Object.keys(data.users).sort()).toEqual(['alice', 'bob', 'carol']);
  expect(data.users.alice.history).toHaveLength(2);
  expect(data.users.alice.leaderboardEntry.pointBreakdown.regularPoints).toBe(4);
  expect(data.groups.smiths).toMatchObject({ memberCount: 2, topScorer: 'alice' });
  expect(data.groups.smiths.description.description).toBe('The Springfield side');
  expect(data.globalCategoryStats.History).toEqual({ total: 4, correct: 3 });
});

test('`current` is the active season', async () => {
  seedSeasons({ currentSeasonNumber: 2, seasons: [spring, summer] });
  const { data } = await read({ season: 'current' });
  expect(data.selectedSeason).toBe(2);
  expect(data.users.alice.history).toHaveLength(1);
  expect(data.seasons.map((s: { name: string }) => s.name)).toEqual(['Spring', 'Summer']);
});

test('`current` between seasons is the latest one that ended', async () => {
  seedSeasons({ currentSeasonNumber: 1, seasons: [spring] });
  const { data } = await read({ season: 'current' });
  expect(data.selectedSeason).toBe(1);
  expect(Object.keys(data.users).sort()).toEqual(['alice', 'bob', 'carol']);
  expect(data.users.carol.leaderboardEntry.questionsAnswered).toBe(1);
});

test('`current` with no seasons yet is all time', async () => {
  seedSeasons({ currentSeasonNumber: 0, seasons: [] });
  const { data } = await read({ season: 'current' });
  expect(data.selectedSeason).toBeUndefined();
  expect(data.users.alice.history).toHaveLength(2);
});
