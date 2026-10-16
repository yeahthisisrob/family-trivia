vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { FactAnswerEntry, Family } from '@family-trivia/shared';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getPersonStory } from '../features/person-story/handlers';
import { invalidateFactHistoryCache } from '../services/factHistoryService';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const family: Family = {
  version: 2,
  name: 'The Example Family',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
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

const answer = (
  day: number,
  text: string,
  extra: Partial<FactAnswerEntry> = {},
): FactAnswerEntry => {
  const date = `2024-01-${String(day).padStart(2, '0')}`;
  return {
    date,
    question: `Question ${day}?`,
    answer: text,
    fact: '',
    answered: true,
    skipped: false,
    timestamp: `${date}T13:00:00.000Z`,
    questionType: 'shared',
    ...extra,
  };
};

const ask = (personId: string) =>
  getPersonStory({ queryStringParameters: { personId } } as unknown as APIGatewayProxyEvent).then(
    (r) => ({ status: r.statusCode, data: JSON.parse(r.body).data }),
  );

beforeEach(() => {
  resetS3Mock();
  invalidateFactHistoryCache();
  seedRaw('family/family.json', family);
  seedRaw('facts/answers/grace.json', [
    answer(3, 'Third'),
    answer(1, 'First', { questionType: 'basic' }),
    answer(2, '', { skipped: true }),
    ...[4, 5, 6, 7, 8].map((d) => answer(d, `Day ${d}`)),
  ]);
  seedRaw('answers/history/grace.json', [
    { timestamp: '2023-12-30T10:00:00.000Z', correct: true },
    { timestamp: '2024-02-01T10:00:00.000Z', correct: false },
  ]);
  seedRaw('reactions/fact/grace_2024-01-03T13:00:00.000Z.json', {
    byUser: { alice: { reaction: 'love', at: '2024-01-04T00:00:00.000Z' } },
  });
  seedRaw('comments/fact/grace_2024-01-05T13:00:00.000Z.json', {
    comments: [
      { id: 'c1', userId: 'alice', text: 'yes', timestamp: '' },
      { id: 'c2', userId: 'alice', text: 'so', timestamp: '' },
    ],
  });
});

test('every real answer, basics included, oldest first; the last five newest first', async () => {
  const { data } = await ask('grace');
  expect(data.words.map((w: { answer: string }) => w.answer)).toEqual([
    'First',
    'Third',
    'Day 4',
    'Day 5',
    'Day 6',
    'Day 7',
    'Day 8',
  ]);
  expect(data.last[0]).toBe('grace_2024-01-08T13:00:00.000Z');
  expect(data.last).toHaveLength(5);
});

test('what the family loved, by reactions and comments together', async () => {
  const { data } = await ask('grace');
  expect(data.loved).toEqual([
    { id: 'grace_2024-01-05T13:00:00.000Z', reactions: 0, comments: 2 },
    { id: 'grace_2024-01-03T13:00:00.000Z', reactions: 1, comments: 0 },
  ]);
});

test('trivia and the whole span they took part in', async () => {
  const { data } = await ask('grace');
  expect(data.trivia).toEqual({ played: 2, right: 1 });
  expect(data.span).toEqual({ first: '2023-12-30', last: '2024-02-01' });
});

test('anyone the family can see, here or remembered', async () => {
  expect((await ask('alice')).status).toBe(200);
  expect((await ask('nobody')).status).toBe(404);
});

test('not someone who never joined', async () => {
  seedRaw('config/member-activation.json', { bob: true });
  expect((await ask('alice')).status).toBe(404);
});
