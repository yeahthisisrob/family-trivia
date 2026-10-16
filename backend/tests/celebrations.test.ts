vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { Family } from '@family-trivia/shared';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { add, getAll, getUpcoming, remove } from '../features/celebrations/handlers';
import { invalidateFactHistoryCache } from '../services/factHistoryService';
import { getStored, resetS3Mock, seedRaw } from './helpers/s3Mock';

const family: Family = {
  version: 2,
  name: 'The Example Family',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    bob: { id: 'bob', name: 'Bob', participation: 'playing', born: { date: '1950-07-24' } },
    carol: { id: 'carol', name: 'Carol', participation: 'playing' },
    dave: { id: 'dave', name: 'Dave', participation: 'playing' },
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

const birthday = (answer: string) => [
  {
    date: '2025-01-01',
    question: 'When is your birthday? (MM/DD)',
    answer,
    fact: '',
    answered: true,
    skipped: false,
    timestamp: '2025-01-01T12:00:00.000Z',
    questionType: 'basic',
    questionIndex: 0,
  },
];

const ev = (q: Record<string, string> | null = null, body?: unknown) =>
  ({
    queryStringParameters: q,
    body: body ? JSON.stringify(body) : null,
  }) as unknown as APIGatewayProxyEvent;
const data = (r: { body: string }) => JSON.parse(r.body).data;

beforeEach(() => {
  resetS3Mock();
  invalidateFactHistoryCache();
  seedRaw('family/family.json', family);
  seedRaw('config/member-activation.json', { alice: true, bob: true, carol: true });
  seedRaw('facts/answers/alice.json', birthday('12/30/1981'));
  seedRaw('facts/answers/bob.json', birthday('01/01'));
  seedRaw('facts/answers/carol.json', birthday('Confidential'));
  seedRaw('facts/answers/dave.json', birthday('05/05'));
  seedRaw('facts/answers/grace.json', birthday('Aug 4'));
});

test('everyone’s birthday, however they wrote it; the family’s record wins', async () => {
  const { celebrations } = data(await getAll());
  const byName = Object.fromEntries(
    celebrations.map((c: { name: string; date: string }) => [c.name, c.date]),
  );
  expect(byName).toEqual({
    "Alice's Birthday": '12/30',
    "Bob's Birthday": '07/24',
    "Grandma Grace's Birthday": '08/04',
  });
});

test('not someone who never joined; remembered people keep their day', async () => {
  const { celebrations } = data(await getAll());
  expect(celebrations.some((c: { name: string }) => c.name.startsWith('Dave'))).toBe(false);
  expect(celebrations.find((c: { name: string }) => c.name.startsWith('Grandma'))).toMatchObject({
    remembered: true,
  });
});

test('upcoming dates in order, with added ones', async () => {
  await add(
    ev(null, { type: 'anniversary', name: 'Our wedding', date: '06/15', year: 1990 }),
    'bob',
  );
  const { birthdays, todaysBirthdays } = data(await getUpcoming(ev({ limit: '10' })));
  const all = [...todaysBirthdays, ...birthdays];
  expect(all.map((b: { name: string }) => b.name).sort()).toEqual([
    'Alice',
    'Bob',
    'Grandma Grace',
    'Our wedding',
  ]);
  const days = birthdays.map((b: { daysUntil: number }) => b.daysUntil);
  expect(days).toEqual([...days].sort((a, b) => a - b));
});

test('the caller adds and only the caller removes', async () => {
  const r = await add(
    ev(null, { type: 'holiday', name: ' Lake day ', date: '07/04', addedBy: 'someone-else' }),
    'bob',
  );
  const { celebration } = data(r);
  expect(celebration).toMatchObject({ addedBy: 'bob', name: 'Lake day', recurring: true });
  expect((await remove(ev({ id: celebration.id }), 'alice')).statusCode).toBe(403);
  expect((await remove(ev({ id: celebration.id }), 'bob')).statusCode).toBe(200);
  expect(
    getStored<{ celebrations: unknown[] }>('celebrations/celebrations.json')?.celebrations,
  ).toEqual([]);
});

test('turns away dates that aren’t real', async () => {
  for (const date of ['02/30', '13/01', '7/4', 'July 4'])
    expect((await add(ev(null, { type: 'other', name: 'x', date }), 'bob')).statusCode).toBe(400);
  expect((await add(ev(null, { type: 'party', name: 'x', date: '07/04' }), 'bob')).statusCode).toBe(
    400,
  );
});
