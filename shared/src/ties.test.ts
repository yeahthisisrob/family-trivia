import { describe, expect, test } from 'vitest';
import { type Family, familyProblems, mentionableRelations, relationOf } from './people';
import { metLine, newTie, tieChoicesFor, tieEnds } from './ties';
import { capitalized, relationWord, wordsFor, yourRelation } from './vocabulary';

/** A friends circle and a family circle on the same model. */
const crew: Family = {
  version: 2,
  name: 'The Crew',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    bob: { id: 'bob', name: 'Bob', participation: 'playing' },
    carol: { id: 'carol', name: 'Carol', participation: 'playing' },
    dave: { id: 'dave', name: 'Dave', participation: 'playing' },
  },
  ties: [
    {
      id: 'f1',
      type: 'friend',
      a: 'alice',
      b: 'bob',
      met: { how: 'college', when: '2004', where: 'Springfield' },
    },
    { id: 'f2', type: 'friend', a: 'bob', b: 'carol' },
    { id: 'p1', type: 'partner', a: 'carol', b: 'dave', kind: 'married' },
  ],
  households: {
    team: { id: 'team', name: 'The old team', members: ['alice', 'dave'] },
  },
};

describe('the tie registry', () => {
  test('friends are friends, partners are partners, a crew is a group', () => {
    expect(relationOf(crew, 'alice', 'bob')).toBe('friend');
    expect(relationOf(crew, 'carol', 'bob')).toBe('friend');
    expect(relationOf(crew, 'carol', 'dave')).toBe('partner');
    expect(relationOf(crew, 'alice', 'dave')).toBe('family');
    expect(relationWord('family', 'friends')).toBe('same crew');
    expect(relationWord('family', 'family')).toBe('family');
    expect(relationOf(crew, 'alice', 'carol')).toBeNull();
  });

  test('how two friends met reaches the AI wording, and never a stranger', () => {
    const rels = mentionableRelations(crew, 'alice');
    expect(rels.find((r) => r.id === 'bob')?.relation).toBe(
      'friend (met in college, 2004, in Springfield)',
    );
    expect(rels.find((r) => r.id === 'dave')).toBeUndefined();
  });

  test('a friendship is checked like any tie', () => {
    expect(familyProblems(crew)).toEqual([]);
    const bad: Family = {
      ...crew,
      ties: [{ id: 'x', type: 'friend', a: 'alice', b: 'zed', met: { when: 'last summer' } }],
    };
    expect(familyProblems(bad)).toEqual([
      `Tie "x" points at someone who isn't in the family.`,
      'Tie "x": when they met should be YYYY.',
    ]);
  });

  test('each kind of circle offers its own ties first, a mixed circle offers all', () => {
    expect(tieChoicesFor('friends').map((c) => c.id)).toEqual(['friend', 'partner', 'kin']);
    expect(tieChoicesFor('family').map((c) => c.id)).toEqual(['partner', 'parent', 'child', 'kin']);
    expect(tieChoicesFor('mixed')).toHaveLength(5);
  });

  test('new ties point the right way', () => {
    expect(tieEnds(newTie('parent', 'carol', 'alice', 't'))).toEqual(['alice', 'carol']);
    expect(tieEnds(newTie('child', 'carol', 'alice', 't'))).toEqual(['carol', 'alice']);
    expect(newTie('friend', 'a', 'b', 't').type).toBe('friend');
  });

  test('a met line uses only what is known', () => {
    expect(metLine({ id: 't', type: 'friend', a: 'a', b: 'b' })).toBeNull();
    expect(metLine({ id: 't', type: 'friend', a: 'a', b: 'b', met: { when: '2011-06-01' } })).toBe(
      'met, 2011',
    );
  });

  test('words follow the kind, family by default', () => {
    expect(wordsFor().group).toBe('household');
    expect(wordsFor('friends').groups).toBe('Crews');
    expect(yourRelation('friend', 'friends')).toBe('Your friend');
    expect(yourRelation('family', 'friends')).toBe('In your crew');
    expect(yourRelation(null, 'family')).toBe('In your family');
  });

  test('the Us tab reads as it always has for a family, and fits the others', () => {
    expect(wordsFor().ties).toBe('Family ties');
    expect(wordsFor().tree).toBe('The family tree');
    expect(capitalized(wordsFor().whose)).toBe("The family's");
    expect(wordsFor('friends').ties).toBe('Friendships');
    expect(`Our ${wordsFor('friends').noun}`).toBe('Our crew');
    expect(wordsFor('mixed').title).toBe('Us');
    expect(wordsFor('mixed').unit).toBe('group');
  });
});
