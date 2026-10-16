vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { FactAnswerEntry, Family } from '@family-trivia/shared';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getSeasonReview } from '../features/look-back/handlers';
import { invalidateFactHistoryCache } from '../services/factHistoryService';
import { invalidateSeasonsCache } from '../services/seasonService';
import { resetS3Mock, seedRaw, seedSeasons } from './helpers/s3Mock';

const family: Family = {
  version: 2,
  name: 'The Example Family',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    bob: { id: 'bob', name: 'Bob', participation: 'playing' },
    grace: {
      id: 'grace',
      name: 'Grandma Grace',
      participation: 'not-playing',
      memorial: { died: '2024-03-01' },
    },
  },
  ties: [],
  households: {},
};

const said = (
  date: string,
  question: string,
  answer: string,
  type: 'shared' | 'basic' = 'shared',
): FactAnswerEntry => ({
  date,
  question,
  answer,
  fact: '',
  answered: true,
  skipped: false,
  timestamp: `${date}T${type === 'basic' ? 14 : 13}:00:00.000Z`,
  questionType: type,
});

const ask = (season?: number) =>
  getSeasonReview({
    queryStringParameters: season ? { season: String(season) } : null,
  } as unknown as APIGatewayProxyEvent).then((r) => ({
    status: r.statusCode,
    data: JSON.parse(r.body).data,
  }));

beforeEach(() => {
  resetS3Mock();
  invalidateFactHistoryCache();
  invalidateSeasonsCache();
  seedRaw('family/family.json', family);
  seedSeasons({
    currentSeasonNumber: null,
    seasons: [
      {
        seasonNumber: 1,
        name: 'Spring',
        status: 'concluded',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        message: null,
      },
      {
        seasonNumber: 2,
        name: 'Summer',
        status: 'concluded',
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        message: null,
      },
    ],
  });
  seedRaw('facts/answers/alice.json', [
    said('2024-01-02', 'Happy place?', 'The beach'),
    said('2024-01-03', 'Comfort food?', 'Soup'),
    said('2024-01-03', 'Favorite color?', 'Green', 'basic'),
    said('2024-06-05', 'Summer plans?', 'Camping'),
  ]);
  seedRaw('facts/answers/bob.json', [said('2024-01-02', 'Happy place?', 'Garden')]);
  seedRaw('facts/answers/grace.json', [said('2024-01-02', 'Happy place?', 'The lake')]);
  seedRaw('answers/history/bob.json', [
    { timestamp: '2024-01-04T10:00:00.000Z', correct: true, pointsEarned: 3 },
    { timestamp: '2024-01-05T10:00:00.000Z', correct: false },
  ]);
  seedRaw('comments/fact/bob_2024-01-02T13:00:00.000Z.json', { comments: [{}, {}] });
  seedRaw('reactions/fact/alice_2024-01-03T13:00:00.000Z.json', { byUser: { bob: {} } });
});

test('a season’s answers only, and the question most of us answered first', async () => {
  const { data } = await ask(1);
  expect(data.season.name).toBe('Spring');
  expect(data.numbers).toMatchObject({
    people: 3,
    answers: 5,
    trivia: 2,
    comments: 2,
    reactions: 1,
    days: 2,
  });
  expect(data.together[0]).toMatchObject({ question: 'Happy place?' });
  expect(data.together[0].answers).toHaveLength(3);
});

test('the book is every shared question, oldest first; basics stay on profiles', async () => {
  const { data } = await ask(1);
  expect(data.book.map((p: { question: string }) => p.question)).toEqual([
    'Happy place?',
    'Comfort food?',
  ]);
});

test('what we loved, and everyone’s season with their trivia points', async () => {
  const { data } = await ask(1);
  expect(data.loved.map((l: { id: string }) => l.id)).toEqual([
    'bob_2024-01-02T13:00:00.000Z',
    'alice_2024-01-03T13:00:00.000Z',
  ]);
  expect(data.people.find((p: { personId: string }) => p.personId === 'bob')).toMatchObject({
    answers: 1,
    trivia: 2,
    right: 1,
    points: 3,
  });
});

test('the latest season when none is asked; unknown ones are 404', async () => {
  const { data } = await ask();
  expect(data.season.name).toBe('Summer');
  expect(data.seasons.map((s: { name: string }) => s.name)).toEqual(['Summer', 'Spring']);
  expect((await ask(9)).status).toBe(404);
});
