// The reads behind Profile and Us (the family, its graph, the knowledge
// index, the family's story, someone's story, their trivia, the spotlight),
// each held to its contract entry by the shared setup (0034): the frontend
// types them from it (0035).
vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { FactAnswerEntry, Family, PersonKnowledge } from '@family-trivia/shared';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getFamily, getFamilyStory } from '../features/family/handlers';
import { getGraph } from '../features/graph/handlers';
import { getKnowledge } from '../features/knowledge/handlers';
import { getPersonStory } from '../features/person-story/handlers';
import { getMemberSummary } from '../routes/memberSummary';
import { userProfile } from '../routes/userProfile';
import { invalidateFactHistoryCache } from '../services/factHistoryService';
import { knowledgeKey } from '../services/knowledge';
import { resetS3Mock, seedDefaultActiveSeason, seedHistory, seedRaw } from './helpers/s3Mock';

/** Every kind of tie, a household, a memorial and a chosen picture. */
const family: Family = {
  version: 2,
  name: 'The Example Family',
  people: {
    alice: {
      id: 'alice',
      name: 'Alice',
      participation: 'playing',
      avatar: { library: 'animal', animal: 'otter', color: 'mint' },
    },
    bob: { id: 'bob', name: 'Bob', participation: 'playing' },
    carol: { id: 'carol', name: 'Carol', participation: 'paused', born: { date: '2010-04-02' } },
    dave: { id: 'dave', name: 'Dave', participation: 'playing', howWeMet: 'college roommates' },
    grace: {
      id: 'grace',
      name: 'Grandma Grace',
      participation: 'not-playing',
      memorial: { died: '2024-03-01', dedication: 'Always in the garden' },
    },
  },
  ties: [
    {
      id: 't1',
      type: 'partner',
      a: 'alice',
      b: 'bob',
      kind: 'married',
      ended: { reason: 'divorced' },
    },
    { id: 't2', type: 'parent', parent: 'alice', child: 'carol', kind: 'birth' },
    { id: 't3', type: 'kin', a: 'grace', b: 'alice', relation: 'grandparent' },
    { id: 't4', type: 'friend', a: 'alice', b: 'dave', met: { how: 'college', when: '2001' } },
  ],
  households: { h1: { id: 'h1', name: 'The Springfield house', members: ['alice', 'carol'] } },
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

const alicesIndex: PersonKnowledge = {
  personId: 'alice',
  read: ['2026-10-11T13:00:00.000Z'],
  items: [
    { kind: 'place', name: 'the coast', says: 'The coast', from: '2026-10-11T13:00:00.000Z' },
  ],
  persona: {
    text: 'Alice goes where the water is.',
    traits: ['outdoors'],
    at: '2026-10-12',
    items: 1,
  },
  updatedAt: '2026-10-12T00:00:00.000Z',
};

const asks = (query: Record<string, string> = {}) =>
  ({ httpMethod: 'GET', queryStringParameters: query }) as unknown as APIGatewayProxyEvent;

const answer = async (
  handler: (e: APIGatewayProxyEvent) => Promise<{ statusCode: number; body: string }>,
  query: Record<string, string> = {},
) => {
  const r = await handler(asks(query));
  return { status: r.statusCode, data: JSON.parse(r.body).data };
};

beforeEach(() => {
  resetS3Mock();
  invalidateFactHistoryCache();
  seedDefaultActiveSeason();
  seedRaw('family/family.json', family);
  seedRaw('facts/answers/alice.json', [said('2026-10-11', 'Best road trip?', 'The coast')]);
  seedRaw(knowledgeKey('alice'), alicesIndex);
  seedHistory('alice', [
    {
      question: {
        question: 'Capital of France?',
        choices: ['Paris', 'Rome'],
        answer: 'Paris',
        category: 'Geography',
        difficulty: 'hard',
        pointMultiplier: 3,
      },
      selectedAnswer: 'Paris',
      correct: true,
      timestamp: '2026-10-12T15:00:00.000Z',
    },
  ]);
});

test('the family, its graph and its story', async () => {
  const people = await answer(getFamily);
  expect(people.status).toBe(200);
  expect(people.data.family.ties).toHaveLength(4);
  const graph = await answer(getGraph);
  expect(graph.status).toBe(200);
  expect(graph.data.households[0]).toMatchObject({ name: 'The Springfield house' });
  expect((await answer(getFamilyStory)).status).toBe(200);
});

test("the knowledge index and someone's story", async () => {
  const knowledge = await answer(getKnowledge);
  expect(knowledge.status).toBe(200);
  expect(knowledge.data.people.alice.persona.text).toContain('water');
  const story = await answer(getPersonStory, { personId: 'alice' });
  expect(story.status).toBe(200);
  expect(story.data.words[0]).toMatchObject({ answer: 'The coast' });
});

test('their trivia: the points and how they were scored', async () => {
  const r = await answer(userProfile, { userId: 'alice' });
  expect(r.status).toBe(200);
  expect(r.data.totalScore).toBe(3);
  expect(r.data.scoringHistory[0]).toMatchObject({ category: 'Geography', pointsEarned: 3 });
});

test('the spotlight, once written', async () => {
  const today = new Date().toISOString();
  seedRaw('summaries/alice/summary.json', {
    userId: 'alice',
    regularSummary: 'Happiest by the water.',
    roastSummary: 'Has never once been on time to the beach.',
    lastUpdated: today,
    generatedAt: { regular: today, roast: today },
    insights: [{ text: 'Loves the coast', category: 'preference' }],
  });
  const r = await answer(getMemberSummary, { userId: 'alice', mode: 'roast' });
  expect(r.status).toBe(200);
  expect(r.data).toMatchObject({ mode: 'roast', summary: expect.stringContaining('on time') });
});
