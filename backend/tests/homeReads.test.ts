// The reads behind Home's older cards (today's question, who has played,
// the week's answers, the timeline, Family Feud), each held to its contract
// entry by the shared setup (0034): the frontend types them from it (0035).
vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { FactAnswerEntry, Family } from '@family-trivia/shared';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getAnswerGrid } from '../routes/answerGrid';
import { getDailyFact, getUserFactHistory } from '../routes/dailyFact';
import { getFactGrid } from '../routes/factGrid';
import { familyFeudStatus } from '../routes/familyFeud';
import { getTimelineData } from '../routes/timelineData';
import { getWeeklyFactSummary } from '../routes/weeklyFactSummary';
import { invalidateFactHistoryCache } from '../services/factHistoryService';
import { resetS3Mock, seedDefaultActiveSeason, seedHistory, seedRaw } from './helpers/s3Mock';

const family: Family = {
  version: 2,
  name: 'The Example Family',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    bob: { id: 'bob', name: 'Bob', participation: 'playing' },
  },
  ties: [],
  households: {},
};

const said = (date: string, question: string, answer: string): FactAnswerEntry => ({
  date,
  question,
  answer,
  fact: `${answer}, noted.`,
  answered: true,
  skipped: false,
  timestamp: `${date}T13:00:00.000Z`,
  questionType: 'shared',
});

const asks = (query: Record<string, string>) =>
  ({ httpMethod: 'GET', queryStringParameters: query }) as unknown as APIGatewayProxyEvent;

const answer = async (
  handler: (e: APIGatewayProxyEvent) => Promise<{ statusCode: number; body: string }>,
  query: Record<string, string>,
) => {
  const r = await handler(asks(query));
  return { status: r.statusCode, data: JSON.parse(r.body).data };
};

beforeEach(() => {
  resetS3Mock();
  invalidateFactHistoryCache();
  seedDefaultActiveSeason();
  seedRaw('family/family.json', family);
  seedRaw('facts/daily/shared/2026-10-11.json', {
    question: 'Best road trip?',
    timestamp: '2026-10-11T08:00:00.000Z',
  });
  seedRaw('facts/answers/alice.json', [said('2026-10-11', 'Best road trip?', 'The coast')]);
  seedHistory('bob', [
    {
      question: { question: 'Capital of France?', choices: ['Paris', 'Rome'], answer: 'Paris' },
      selectedAnswer: 'Paris',
      correct: true,
      timestamp: '2026-10-12T15:00:00.000Z',
    },
  ]);
});

test('who has played: the fact grid and the answer grid', async () => {
  const facts = await answer(getFactGrid, { userId: 'alice' });
  expect(facts.status).toBe(200);
  expect(facts.data.rows.length).toBeGreaterThan(0);
  expect((await answer(getAnswerGrid, { userId: 'alice' })).status).toBe(200);
});

test("today's question and the answers it builds the queue from", async () => {
  const history = await answer(getUserFactHistory, { userId: 'alice', includeGlobal: 'true' });
  expect(history.status).toBe(200);
  expect(history.data.history[0]).toMatchObject({ question: 'Best road trip?', answered: true });
  expect(history.data.allSharedQuestions[0]).toMatchObject({ date: '2026-10-11' });
});

test('the timeline and Family Feud', async () => {
  const timeline = await answer(getTimelineData, { side: 'all', limit: '20' });
  expect(timeline.status).toBe(200);
  expect(timeline.data.timelineData.facts[0]).toMatchObject({ userId: 'alice' });
  expect(timeline.data.timelineData.trivia[0]).toMatchObject({ userId: 'bob' });
  expect((await answer(familyFeudStatus, { userId: 'alice' })).status).toBe(200);
});

test("the week's answers, for a week nobody answered", async () => {
  const r = await answer(getWeeklyFactSummary, { weekStart: '2020-01-05' });
  expect(r.status).toBe(200);
  expect(r.data.totalResponses).toBe(0);
});

test('the daily question, once asked', async () => {
  seedRaw(`facts/daily/shared/${new Date().toISOString().slice(0, 10)}.json`, {
    question: 'Favorite snack?',
    timestamp: new Date().toISOString(),
  });
  const r = await answer(getDailyFact, { userId: 'alice' });
  expect(r.status).toBe(200);
});
