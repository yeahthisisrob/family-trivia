// The reads and changes behind Admin › Player Data (a person's facts and
// trivia, open plays, Family Feud) and the Trivia Bank, each held to its
// contract entry by the shared setup (0034): the frontend types them from it
// (0035).
vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { APIGatewayProxyEvent } from 'aws-lambda';
import {
  deleteUserFact,
  deleteUserTrivia,
  getGameSessions,
  getUserFacts,
  getUserTrivia,
  updateUserFact,
} from '../routes/admin';
import { adminGetFamilyFeud, adminResetFamilyFeud } from '../routes/familyFeud';
import {
  triviaBankBrowse,
  triviaBankDelete,
  triviaBankImport,
  triviaBankStats,
} from '../routes/triviaBankAdmin';
import { invalidateFactHistoryCache } from '../services/factHistoryService';
import { invalidateUserConfigCache } from '../services/users';
import { getStored, resetS3Mock, seedHistory, seedRaw } from './helpers/s3Mock';

const users = {
  version: '1',
  lastUpdated: '2026-10-01T00:00:00.000Z',
  users: {
    alice: { group: 'smiths', color: '#2e7d32', isAdmin: true },
    bob: { group: 'smiths', color: '#1976d2' },
  },
};

const facts = [
  {
    timestamp: '2026-10-12T09:00:00.000Z',
    date: '2026-10-12',
    question: 'Best pie?',
    answer: 'Apple',
    fact: 'Apple',
    answered: true,
    questionType: 'shared',
  },
  {
    timestamp: '2026-10-13T09:00:00.000Z',
    date: '2026-10-13',
    question: 'Where did you grow up?',
    answer: '',
    answered: false,
    skipped: true,
    questionType: 'basic',
    questionIndex: 2,
  },
];

const question = {
  question: 'Which planet is red?',
  choices: ['Mars', 'Venus', 'Jupiter', 'Saturn'],
  answer: 'Mars',
  category: 'Science & Nature',
  difficulty: 'normal' as const,
};

const round = (roundId: string, status: string) => ({
  roundId,
  targetUserId: 'bob',
  targetUserName: 'Bob',
  question: "What is Bob's favourite pie?",
  realAnswer: status === 'completed' ? 'Apple' : null,
  choices: null,
  answeredAt: null,
  startedAt: '2026-10-18T09:00:00.000Z',
  expiresAt: '2026-10-20T09:00:00.000Z',
  status,
  guesses: {
    alice: {
      userId: 'alice',
      userName: 'Alice',
      guess: 'Apple',
      submittedAt: '2026-10-18T10:00:00.000Z',
    },
  },
  ...(status === 'completed'
    ? {
        results: {
          winners: [{ userId: 'alice', userName: 'Alice', points: 10 }],
          totalGuesses: 1,
          revealedAt: '2026-10-20T09:00:00.000Z',
        },
      }
    : {}),
});

const bank = {
  timestamp: '2026-10-01T00:00:00.000Z',
  count: 2,
  questions: [
    { ...question, source: 'opentdb' },
    { ...question, question: 'Which planet has rings?', answer: 'Saturn', source: 'custom' },
  ],
};

const asks = (query: Record<string, string> = {}, body?: unknown) =>
  ({
    httpMethod: body ? 'POST' : 'GET',
    queryStringParameters: query,
    body: body ? JSON.stringify(body) : null,
  }) as unknown as APIGatewayProxyEvent;

type Handler = (
  e: APIGatewayProxyEvent,
  userId: string,
) => Promise<{ statusCode: number; body: string }>;
const answer = async (handler: Handler, event: APIGatewayProxyEvent) => {
  const r = await handler(event, 'alice');
  return { status: r.statusCode, data: JSON.parse(r.body).data };
};
const admin = { adminUserId: 'alice' };

beforeEach(() => {
  resetS3Mock();
  invalidateUserConfigCache();
  invalidateFactHistoryCache();
  seedRaw('config/users.json', users);
  // Copies: the handlers change what they read in place.
  seedRaw('facts/answers/bob.json', structuredClone(facts));
  seedHistory('bob', [
    { question, selectedAnswer: 'Mars', correct: true, timestamp: '2026-10-14T09:00:00.000Z' },
  ]);
  seedRaw('family-feud/current-round.json', round('2026-10-18_bob', 'active'));
  seedRaw('family-feud/rounds/2026-10-11_bob.json', round('2026-10-11_bob', 'completed'));
  seedRaw('trivia-bank/Science___Nature/normal.json', structuredClone(bank));
});

afterEach(() => vi.unstubAllGlobals());

test("a person's facts, a skipped one among them; changing one and deleting one", async () => {
  const r = await answer(getUserFacts, asks({ ...admin, userId: 'bob' }));
  expect(r.status).toBe(200);
  expect(r.data.facts).toHaveLength(2);
  expect(r.data.facts[1]).toMatchObject({ skipped: true, questionType: 'basic', questionIndex: 2 });

  const changed = await answer(
    updateUserFact,
    asks({}, { ...admin, userId: 'bob', timestamp: facts[0]?.timestamp, answer: 'Cherry' }),
  );
  expect(changed.data).toEqual({ success: true });
  const removed = await answer(
    deleteUserFact,
    asks({}, { ...admin, userId: 'bob', timestamp: facts[1]?.timestamp }),
  );
  expect(removed.data).toEqual({ success: true, removed: 1 });
  expect(getStored<{ answer: string }[]>('facts/answers/bob.json')?.map((f) => f.answer)).toEqual([
    'Cherry',
  ]);
});

test("a person's trivia, and deleting an answer", async () => {
  const r = await answer(getUserTrivia, asks({ ...admin, userId: 'bob' }));
  expect(r.data.history).toHaveLength(1);
  expect(r.data.history[0]).toMatchObject({
    correct: true,
    question: { category: 'Science & Nature' },
  });
  const removed = await answer(
    deleteUserTrivia,
    asks({}, { ...admin, userId: 'bob', timestamps: ['2026-10-14T09:00:00.000Z'] }),
  );
  expect(removed.data).toEqual({ success: true, removedCount: 1 });
});

test('the plays left open across the circle', async () => {
  const r = await answer(getGameSessions, asks(admin));
  expect(r.status).toBe(200);
  expect(r.data.sessions).toEqual([]);
});

test('Family Feud as stored, and an admin resetting the current round', async () => {
  const r = await answer(adminGetFamilyFeud, asks(admin));
  expect(r.data.currentRound).toMatchObject({ roundId: '2026-10-18_bob', status: 'active' });
  expect(r.data.recentRounds[0].results.winners[0].points).toBe(10);

  const reset = await answer(adminResetFamilyFeud, asks({}, { ...admin, action: 'reset-current' }));
  expect(reset.data).toEqual({ success: true, action: 'reset-current' });
  expect((await answer(adminGetFamilyFeud, asks(admin))).data.currentRound).toBeNull();
});

test('the trivia bank: its numbers, a page of it, and deleting a question', async () => {
  const stats = await answer(triviaBankStats, asks(admin));
  expect(stats.data).toMatchObject({
    totalQuestions: 2,
    categories: [{ category: 'Science & Nature', count: 2, difficulties: { normal: 2 } }],
  });
  expect(stats.data.sources).toEqual([
    ['opentdb', 1],
    ['custom', 1],
  ]);

  const page = await answer(
    triviaBankBrowse,
    asks({ ...admin, category: 'Science & Nature', difficulty: 'normal', limit: '1' }),
  );
  expect(page.data.total).toBe(2);
  expect(page.data.questions.map((q: { question: string }) => q.question)).toEqual([
    'Which planet is red?',
  ]);

  const removed = await answer(
    triviaBankDelete,
    asks(
      {},
      {
        ...admin,
        category: 'Science & Nature',
        difficulty: 'normal',
        questionText: 'Which planet is red?',
      },
    ),
  );
  expect(removed.data).toEqual({ deleted: true });
});

test('importing into the trivia bank says what it added and what it already had', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        response_code: 0,
        results: [
          {
            type: 'multiple',
            question: 'Which planet is red?',
            correct_answer: 'Mars',
            incorrect_answers: ['Venus', 'Jupiter', 'Saturn'],
          },
          {
            type: 'multiple',
            question: 'Which planet is largest?',
            correct_answer: 'Jupiter',
            incorrect_answers: ['Mars', 'Venus', 'Saturn'],
          },
        ],
      }),
    ),
  );
  // The import waits between requests to the source (its rate limit).
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  const importing = answer(
    triviaBankImport,
    asks(
      {},
      { ...admin, source: 'opentdb', category: 'Science & Nature', difficulty: 'normal', count: 2 },
    ),
  );
  await vi.runAllTimersAsync();
  const r = await importing;
  vi.useRealTimers();
  expect(r.status).toBe(200);
  // Science & Nature is two of the source's categories, each asked once.
  expect(r.data).toMatchObject({ source: 'OpenTDB', fetched: 4, added: 1, duplicates: 3 });
});

test('Player Data and the Trivia Bank are for admins only', async () => {
  expect((await getUserFacts(asks({ adminUserId: 'bob', userId: 'bob' }))).statusCode).toBe(403);
  expect((await triviaBankStats(asks({ adminUserId: 'bob' }))).statusCode).toBe(403);
  expect((await adminGetFamilyFeud(asks({ adminUserId: 'bob' }))).statusCode).toBe(403);
});
