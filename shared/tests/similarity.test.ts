import { describe, expect, test } from 'vitest';
import { alike, keywords, likenesses } from '../src/similarity';

describe('alike', () => {
  test.each([
    ['The beach!', 'beach days with the kids', true],
    ['Pizza', 'pizza, always pizza', true],
    ['Grandma’s apple pie', 'apple pie', true],
    ['Hiking in the mountains', 'Reading by the fire', false],
    ['', 'anything', false],
    ['I love it', 'I love it', false], // nothing but stop words
  ])('%s / %s → %s', (x, y, expected) => {
    expect(alike(x, y)).toBe(expected);
  });

  test('keywords drop filler and plurals', () => {
    expect([...keywords('My favorite things are the Dogs and books')]).toEqual(['dog', 'book']);
  });
});

describe('likenesses', () => {
  const answers = [
    { personId: 'alice', question: 'Happy place?', answer: 'The beach' },
    { personId: 'bob', question: 'Happy place?', answer: 'Beach house in summer' },
    { personId: 'carol', question: 'Happy place?', answer: 'Mountains' },
    { personId: 'alice', question: 'Comfort food?', answer: 'Mac and cheese' },
    { personId: 'bob', question: 'Comfort food?', answer: 'Mom’s mac and cheese' },
    { personId: 'carol', question: 'Comfort food?', answer: 'Ramen' },
  ];

  test('connects people who answered alike, with the evidence', () => {
    const [top, ...rest] = likenesses(answers);
    expect(top).toMatchObject({ a: 'alice', b: 'bob', count: 2, strength: 1 });
    expect(top?.examples[0]).toEqual({
      question: 'Happy place?',
      a: 'The beach',
      b: 'Beach house in summer',
    });
    expect(rest).toEqual([]);
  });

  test('a person answering twice counts once (the latest)', () => {
    const twice = [
      ...answers,
      { personId: 'carol', question: 'Happy place?', answer: 'the beach' },
    ];
    expect(likenesses(twice).some((l) => l.a === 'alice' && l.b === 'carol')).toBe(true);
  });
});
