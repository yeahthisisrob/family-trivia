vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { FactAnswerEntry, Family } from '@family-trivia/shared';
import { pickMemory } from '../features/look-back/memory';
import { invalidateFactHistoryCache } from '../services/factHistoryService';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const family: Family = {
  version: 2,
  name: 'The Example Family',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    bob: { id: 'bob', name: 'Bob', participation: 'playing' },
    carol: { id: 'carol', name: 'Carol', participation: 'playing' },
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

beforeEach(() => {
  resetS3Mock();
  invalidateFactHistoryCache();
  seedRaw('family/family.json', family);
  seedRaw('facts/answers/alice.json', [
    said('2024-10-16', 'Happy place?', 'The beach'),
    said('2025-03-01', 'Comfort food?', 'Soup'),
    said('2025-05-05', 'Only me?', 'Yes'),
    said('2026-12-01', 'Not yet?', 'Later'),
  ]);
  seedRaw('facts/answers/bob.json', [
    said('2024-10-16', 'Happy place?', 'The garden'),
    said('2025-03-01', 'Comfort food?', 'Pie'),
    said('2026-12-01', 'Not yet?', 'Later'),
  ]);
});

test('a question asked on this day in an earlier year comes first', async () => {
  const m = await pickMemory('2026-10-16');
  expect(m).toMatchObject({ kind: 'on-this-day', asked: '2024-10-16', question: 'Happy place?' });
  expect(m?.answers.map((a) => a.answer)).toEqual(['The beach', 'The garden']);
  expect(m?.answers[0]?.id).toBe('alice_2024-10-16T13:00:00.000Z');
});

test('otherwise a day from our pages, the same all day; never one person alone, never ahead', async () => {
  const a = await pickMemory('2026-10-17');
  const b = await pickMemory('2026-10-17');
  expect(a).toEqual(b);
  expect(a?.kind).toBe('from-our-pages');
  expect(['Happy place?', 'Comfort food?']).toContain(a?.question);
});

test('nothing to bring back yet', async () => {
  seedRaw('facts/answers/alice.json', []);
  seedRaw('facts/answers/bob.json', []);
  invalidateFactHistoryCache();
  expect(await pickMemory('2026-10-17')).toBeNull();
});
