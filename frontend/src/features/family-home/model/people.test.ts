import type { Family } from '@family-trivia/shared';
import { describe, expect, test } from 'vitest';
import type { GraphData } from '../../../entities/family';
import { peopleFor, relationLabel, sortForMe, spotlightOf } from './people';

const data: GraphData = {
  people: [
    {
      id: 'carol',
      name: 'Carol',
      participation: 'playing',
      remembered: false,
      died: null,
      activity: { facts: 10, trivia: 20, correct: 15, since: '2024-03-01' },
    },
    {
      id: 'alice',
      name: 'Mom',
      participation: 'playing',
      remembered: false,
      died: null,
      activity: { facts: 5, trivia: 0 },
    },
    {
      id: 'grace',
      name: 'Grandma Grace',
      participation: 'not-playing',
      remembered: true,
      died: '2024',
      activity: { facts: 8, trivia: 0 },
    },
    {
      id: 'buddy',
      name: 'Uncle Buddy',
      participation: 'not-playing',
      remembered: false,
      died: null,
      activity: { facts: 0, trivia: 0 },
    },
  ],
  ties: [
    { id: 't1', type: 'parent', parent: 'alice', child: 'carol', kind: 'birth' },
    { id: 't2', type: 'parent', parent: 'grace', child: 'alice', kind: 'birth' },
  ],
  households: [{ id: 'mom', name: "Mom's house", members: ['alice', 'carol'] }],
  likenesses: [],
};
const family: Family = {
  version: 2,
  name: 'X',
  people: Object.fromEntries(
    data.people.map((p) => [p.id, { id: p.id, name: p.name, participation: p.participation }]),
  ),
  ties: data.ties,
  households: { mom: data.households[0]! },
};

describe('people on the Family tab', () => {
  const people = peopleFor(data, family, 'carol');

  test('relations, homes and numbers for the person looking', () => {
    const mom = people.find((p) => p.id === 'alice');
    expect(mom?.relation).toBe('parent');
    expect(mom?.homes).toEqual([{ id: 'mom', name: "Mom's house" }]);
    expect(people.find((p) => p.id === 'carol')).toMatchObject({
      accuracy: 75,
      sinceYear: '2024',
      relation: null,
    });
    expect(people.find((p) => p.id === 'buddy')?.notPlaying).toBe(true);
    expect(relationLabel('cousin', false)).toBe('your cousin');
  });

  test('me first, then closest family', () => {
    expect(
      sortForMe(people, 'carol')
        .map((p) => p.id)
        .slice(0, 2),
    ).toEqual(['carol', 'alice']);
  });

  test('the spotlight is the same all day, skips people with nothing shared, and moves on tomorrow', () => {
    const day = new Date(2026, 9, 16, 8);
    const later = new Date(2026, 9, 16, 22);
    const { today, tomorrow } = spotlightOf(people, day);
    expect(today?.id).toBe(spotlightOf(people, later).today?.id);
    expect(today?.id).not.toBe('buddy');
    expect(tomorrow?.id).not.toBe(today?.id);
  });
});
