import { categoriesFor, FAMILY_CATEGORY, type Family, seasonTriviaOf } from '@family-trivia/shared';
import { connectionQuestion, groundedIn } from '../services/familyTrivia';

const family: Family = {
  version: 2,
  name: 'The Example Family',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    bob: { id: 'bob', name: 'Bob', participation: 'playing' },
    erin: { id: 'erin', name: 'Erin', participation: 'playing' },
    carol: { id: 'carol', name: 'Carol', participation: 'playing' },
    dave: { id: 'dave', name: 'Dave', participation: 'playing' },
    grace: {
      id: 'grace',
      name: 'Grandma Grace',
      participation: 'not-playing',
      memorial: { died: '2024' },
    },
  },
  ties: [
    {
      id: 'p1',
      type: 'partner',
      a: 'alice',
      b: 'bob',
      kind: 'married',
      ended: { reason: 'divorced' },
    },
    { id: 'p2', type: 'partner', a: 'bob', b: 'erin', kind: 'married' },
    { id: 'c1', type: 'parent', parent: 'alice', child: 'carol', kind: 'birth' },
    { id: 'c2', type: 'parent', parent: 'bob', child: 'carol', kind: 'birth' },
    { id: 'c3', type: 'parent', parent: 'alice', child: 'dave', kind: 'birth' },
    { id: 'c4', type: 'parent', parent: 'grace', child: 'bob', kind: 'birth' },
  ],
  households: {},
};

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

test('connection questions: one right answer, never a former partner', () => {
  for (let s = 1; s < 200; s++) {
    const q = connectionQuestion(family, 'carol', 'normal', seeded(s));
    expect(q).not.toBeNull();
    expect(q!.choices).toContain(q!.answer);
    expect(new Set(q!.choices).size).toBe(4);
    expect(q!.category).toBe(FAMILY_CATEGORY.name);
    // Alice and Bob are divorced: neither is ever "the partner" of the other.
    expect(q!.question === "Who is Alice's partner?" && q!.answer === 'Bob').toBe(false);
    if (q!.question.startsWith('Who is Bob')) expect(q!.question).not.toContain('former');
  }
});

test('remembered people are spoken of in the past tense', () => {
  const qs = Array.from({ length: 300 }, (_, s) =>
    connectionQuestion(family, 'carol', 'normal', seeded(s + 1)),
  );
  const aboutGrace = qs.filter((q) => q?.question.includes('Grandma Grace'));
  expect(aboutGrace.length).toBeGreaterThan(0);
  for (const q of aboutGrace) expect(q!.question).toMatch(/^Who was/);
});

test('an AI question must be grounded in the answer it cites', () => {
  const source = {
    n: 0,
    personId: 'alice',
    name: 'Alice',
    question: 'Happy place?',
    answer: 'The beach at sunrise with coffee',
  };
  expect(groundedIn({ answer: 'Alice' }, source)).toBe(true);
  expect(groundedIn({ answer: 'The beach at sunrise' }, source)).toBe(true);
  expect(groundedIn({ answer: 'Mountains' }, source)).toBe(false);
});

test('a season offers the categories its trivia mode asks for', () => {
  const sys = [{ name: 'History', description: '' }];
  expect(seasonTriviaOf({})).toBe('general');
  expect(categoriesFor(sys, 'general')).toEqual(sys);
  expect(categoriesFor(sys, 'family')).toEqual([FAMILY_CATEGORY]);
  expect(categoriesFor(sys, 'mixed').map((c) => c.name)).toEqual(['Our Family', 'History']);
});
