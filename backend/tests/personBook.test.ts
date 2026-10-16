vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);
vi.mock('../services/media', () => ({
  downloadUrl: async (key: string) => `https://example.test/${key}`,
}));

import type { FactAnswerEntry, Family } from '@family-trivia/shared';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { listPersonBooks, makePersonBook } from '../features/person-story/bookHandler';
import { invalidateFactHistoryCache } from '../services/factHistoryService';
import { getStored, listStored, resetS3Mock, seedRaw } from './helpers/s3Mock';

const family: Family = {
  version: 2,
  name: 'The Example Family',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    grace: {
      id: 'grace',
      name: 'Grandma Grace',
      participation: 'not-playing',
      born: { date: '1938-04-02' },
      memorial: { died: '2024-03-01', dedication: 'Always in the garden.' },
    },
  },
  ties: [],
  households: {},
};
const said = (date: string, question: string, answer: string): FactAnswerEntry => ({
  date,
  question,
  answer,
  fact: '',
  answered: true,
  skipped: false,
  timestamp: `${date}T13:00:00.000Z`,
  questionType: 'shared',
});
const make = (body: unknown) =>
  makePersonBook({ body: JSON.stringify(body) } as APIGatewayProxyEvent).then((r) => ({
    status: r.statusCode,
    data: JSON.parse(r.body).data,
  }));

beforeEach(() => {
  resetS3Mock();
  invalidateFactHistoryCache();
  seedRaw('family/family.json', family);
  seedRaw('facts/answers/grace.json', [
    said('2023-05-02', 'Who taught you to cook?', 'My mother'),
    said('2024-02-10', 'Which possession would you keep forever?', 'My recipe box'),
  ]);
  seedRaw('comments/memorial/grace.json', {
    comments: [
      { id: 'm1', userId: 'alice', text: 'Pie by the window.', timestamp: '2024-03-10T00:00:00Z' },
    ],
  });
});

test('their words and the family’s memories, as a book kept with what it was made from', async () => {
  const { status, data } = await make({ personId: 'grace' });
  expect(status).toBe(200);
  expect(data).toMatchObject({ made: true });
  expect(data.pages % 2).toBe(0);
  // Its cover, made for its page count, beside it.
  expect(data.coverUrl).toMatch(/books\/people\/grace\/.+\.cover\.pdf$/);
  expect(listStored('books/people/grace/').filter((k) => k.endsWith('.cover.pdf'))).toHaveLength(1);
  const kept = getStored<{ input: { years: string; memories: unknown[]; dedication: string } }>(
    listStored('books/people/grace/').find((k) => k.endsWith('.input.json')) ?? '',
  );
  expect(kept?.input).toMatchObject({ years: '1938 – 2024', dedication: 'Always in the garden.' });
  expect(kept?.input.memories).toHaveLength(1);
});

test('kept until something changes, and every version listed', async () => {
  await make({ personId: 'grace' });
  expect((await make({ personId: 'grace' })).data.made).toBe(false);
  seedRaw('comments/memorial/grace.json', {
    comments: [
      { id: 'm1', userId: 'alice', text: 'Pie by the window.', timestamp: '2024-03-10T00:00:00Z' },
      { id: 'm2', userId: 'alice', text: 'Moon River.', timestamp: '2024-03-11T00:00:00Z' },
    ],
  });
  expect((await make({ personId: 'grace' })).data.made).toBe(true);
  const r = await listPersonBooks({
    queryStringParameters: { personId: 'grace' },
  } as unknown as APIGatewayProxyEvent);
  expect(JSON.parse(r.body).data.versions).toHaveLength(2);
});

test('nobody unknown, and nothing to print for someone who hasn’t answered', async () => {
  expect((await make({ personId: 'nobody' })).status).toBe(404);
  expect((await make({ personId: 'alice' })).status).toBe(404);
});
