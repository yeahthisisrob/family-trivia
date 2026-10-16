vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);
const ai = vi.hoisted(() => ({ reads: [] as string[][], personas: 0 }));
vi.mock('../features/knowledge/ai', () => ({
  readAnswers: async (_name: string, said: { at: string; answer: string }[]) => {
    ai.reads.push(said.map((s) => s.answer));
    return said.map((s) => ({
      kind: 'place',
      name: s.answer.includes('beach') ? 'The Beach' : s.answer,
      says: s.answer,
      from: s.at,
    }));
  },
  writePersona: async (_n: string, k: { items: unknown[] }) => {
    ai.personas++;
    return { text: 'Loves the water.', traits: ['outdoorsy'], at: 'now', items: k.items.length };
  },
}));

import { bestStreak, familyThemes, normalizeName } from '@family-trivia/shared';
import { buildSome, familyKnowledge } from '../features/knowledge/index';
import { invalidateFactHistoryCache } from '../services/factHistoryService';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const answer = (date: string, text: string) => ({
  date,
  question: `Q ${date}`,
  answer: text,
  fact: '',
  answered: true,
  skipped: false,
  timestamp: `${date}T12:00:00.000Z`,
  questionType: 'shared',
});

beforeEach(() => {
  resetS3Mock();
  invalidateFactHistoryCache();
  ai.reads = [];
  ai.personas = 0;
  seedRaw('family/family.json', {
    version: 2,
    name: 'The Example Family',
    people: {
      alice: { id: 'alice', name: 'Alice', participation: 'playing' },
      bob: { id: 'bob', name: 'Bob', participation: 'playing' },
      quiet: { id: 'quiet', name: 'Quinn', participation: 'playing', noAiMentions: true },
      sam: { id: 'sam', name: 'Uncle Sam', participation: 'not-playing' },
    },
    ties: [],
    households: {},
  });
  seedRaw('config/member-activation.json', { alice: true, bob: true, quiet: true });
  seedRaw('facts/answers/alice.json', [
    answer('2026-01-01', 'the beach at sunrise'),
    answer('2026-01-02', 'Italy'),
  ]);
  seedRaw('facts/answers/bob.json', [
    answer('2026-01-01', 'beach, always'),
    answer('2026-01-03', 'pie'),
  ]);
  seedRaw('facts/answers/quiet.json', [answer('2026-01-01', 'beach')]);
});

test('reads each answer once, never opted-out or unjoined people', async () => {
  const first = await buildSome();
  expect(first.read).toBe(4);
  expect(first.left).toBe(0);
  expect(ai.reads.flat()).not.toContain('beach');
  expect(ai.personas).toBe(2);

  const again = await buildSome();
  expect(again.read).toBe(0);
  expect(ai.reads).toHaveLength(2);
});

test('the family view: shared themes, top things, counted numbers', async () => {
  await buildSome();
  const k = await familyKnowledge();
  expect(k.themes.map((t) => [t.name, t.people.sort()])).toEqual([['beach', ['alice', 'bob']]]);
  expect(k.people.alice?.persona?.text).toBe('Loves the water.');
  expect(k.people.sam).toBeUndefined();
  expect(k.stats.answers).toBe(5);
  expect(k.stats.longestAnswer?.personId).toBe('alice');
});

test('names, themes and streaks', () => {
  expect(normalizeName('The Beach!')).toBe('beach');
  expect(bestStreak(['2026-01-01', '2026-01-02', '2026-01-04', '2026-01-05', '2026-01-06'])).toBe(
    3,
  );
  expect(familyThemes([])).toEqual([]);
});
