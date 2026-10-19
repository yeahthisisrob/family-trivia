import { describe, expect, test } from 'vitest';
import { type Family, fromLegacyHierarchy, toLegacyHierarchy } from './people';

const family: Family = {
  version: 2,
  name: 'The Smiths',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    bob: { id: 'bob', name: 'Bob', participation: 'playing' },
    carol: { id: 'carol', name: 'Carol', participation: 'playing' },
    dave: { id: 'dave', name: 'Dave', participation: 'not-playing' },
    erin: { id: 'erin', name: 'Erin', participation: 'playing' },
  },
  ties: [
    { id: 't1', type: 'partner', a: 'alice', b: 'bob', kind: 'married' },
    { id: 't2', type: 'parent', parent: 'alice', child: 'carol', kind: 'birth' },
    { id: 't3', type: 'parent', parent: 'bob', child: 'carol', kind: 'birth' },
    {
      id: 't4',
      type: 'partner',
      a: 'carol',
      b: 'dave',
      kind: 'partnered',
      ended: { reason: 'separated' },
    },
    { id: 't5', type: 'kin', a: 'erin', b: 'carol', relation: 'cousin' },
  ],
  households: {
    smiths: { id: 'smiths', name: 'The Smiths', members: ['alice', 'bob', 'carol'] },
  },
};

describe('toLegacyHierarchy', () => {
  test('people, households and current ties come out in the version 1 shape', () => {
    const h = toLegacyHierarchy(family);
    expect(h.family.people.carol).toEqual({ id: 'carol', name: 'Carol', groupId: 'smiths' });
    expect(h.family.people.erin?.groupId).toBe('');
    expect(h.family.groups?.smiths?.members).toEqual(['alice', 'bob', 'carol']);
    expect(h.family.relationships).toContainEqual({
      type: 'parents-of',
      parent1: 'alice',
      parent2: 'bob',
      children: ['carol'],
    });
  });

  test('an ended partnership is history, not shown as together', () => {
    const rels = toLegacyHierarchy(family).family.relationships ?? [];
    expect(rels.filter((r) => r.type === 'partners')).toEqual([
      { type: 'partners', partner1: 'alice', partner2: 'bob' },
    ]);
  });

  test('reading it back gives the same people, households and current ties', () => {
    const back = fromLegacyHierarchy(toLegacyHierarchy(family), ['alice', 'bob', 'carol', 'erin']);
    expect(Object.keys(back.people).sort()).toEqual(['alice', 'bob', 'carol', 'dave', 'erin']);
    expect(back.households.smiths?.members).toEqual(['alice', 'bob', 'carol']);
    expect(back.ties.map((t) => t.type).sort()).toEqual(['kin', 'parent', 'parent', 'partner']);
  });

  test('a circle with no ties at all is still a valid hierarchy', () => {
    const h = toLegacyHierarchy({ ...family, ties: [], households: {} });
    expect(h.family.relationships).toEqual([]);
    expect(Object.keys(h.family.people)).toHaveLength(5);
  });
});
