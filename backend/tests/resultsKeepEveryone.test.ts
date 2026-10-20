vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { Family } from '@family-trivia/shared';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getConsolidatedLeaderboard } from '../routes/consolidatedLeaderboard';
import { leaderboard } from '../routes/leaderboard';
import { invalidateUserConfigCache } from '../services/users';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

// What people did stays theirs: someone remembered or taking a break keeps
// their place in the results of the seasons they played. Only people with
// nothing to show and not playing now are left off.
const accounts = {
  version: '1',
  lastUpdated: '2026-01-01',
  users: {
    alice: { group: 'smiths', color: '#111' },
    bob: { group: 'smiths', color: '#222' },
    carol: { group: 'joneses', color: '#333' },
    erin: { group: 'joneses', color: '#444' },
  },
};

const family: Family = {
  version: 2,
  name: 'Example',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    bob: { id: 'bob', name: 'Bob', participation: 'paused' },
    carol: {
      id: 'carol',
      name: 'Carol',
      participation: 'playing',
      memorial: { died: '2026-03-01' },
    },
    erin: { id: 'erin', name: 'Erin', participation: 'paused' },
  },
  ties: [],
  households: {},
};

const answer = (day: string) => ({
  timestamp: `${day}T12:00:00.000Z`,
  correct: true,
  selectedAnswer: 'A',
  question: {
    question: 'Q',
    choices: ['A', 'B', 'C', 'D'],
    answer: 'A',
    category: 'History',
    difficulty: 'normal',
  },
});

const event = (query: Record<string, string> = {}) =>
  ({ queryStringParameters: query }) as unknown as APIGatewayProxyEvent;
const body = (r: { body: string }) => JSON.parse(r.body).data;

beforeEach(() => {
  resetS3Mock();
  invalidateUserConfigCache();
  seedRaw('config/users.json', accounts);
  seedRaw('family/family.json', family);
  seedRaw('config/seasons.json', {
    seasons: [
      {
        seasonNumber: 1,
        name: 'Spring',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        status: 'concluded',
      },
    ],
  });
  seedRaw('answers/history/alice.json', [answer('2026-02-01')]);
  seedRaw('answers/history/bob.json', [answer('2026-02-02')]);
  seedRaw('answers/history/carol.json', [answer('2026-02-03'), answer('2026-02-04')]);
});

test('the leaderboard keeps remembered and paused people who played', async () => {
  const all = body(await leaderboard(event())).all;
  expect(all.map((e: { userId: string }) => e.userId).sort()).toEqual(['alice', 'bob', 'carol']);
  const joneses = body(await leaderboard(event({ groupId: 'joneses' })));
  expect(joneses.map((e: { userId: string }) => e.userId)).toEqual(['carol']);
});

test("a season's results keep everyone who played in it", async () => {
  const data = body(await getConsolidatedLeaderboard(event({ season: '1' })));
  expect(Object.keys(data.users).sort()).toEqual(['alice', 'bob', 'carol']);
  expect(data.users.carol.leaderboardEntry.questionsAnswered).toBe(2);
  expect(data.userGroups.carol).toBe('joneses');
  expect(data.groups.joneses.memberCount ?? data.groups.joneses.totalMembers).toBeDefined();
});
