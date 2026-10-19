import { describe, expect, test } from 'vitest';
import { type Family, relationOf } from './people';
import { NOT_MET, threadChoicesFor, tieFromAnswer } from './threads';

const two: Family = {
  version: 2,
  name: 'Two',
  people: {
    me: { id: 'me', name: 'Me', participation: 'playing' },
    them: { id: 'them', name: 'Them', participation: 'playing' },
  },
  ties: [],
  households: {},
};
const said = (choice: string) => {
  const tie = tieFromAnswer('me', { about: 'them', choice }, 't');
  return tie && relationOf({ ...two, ties: [tie] }, 'me', 'them');
};

describe('threads', () => {
  test('every family answer reads back as what was said', () => {
    expect(said('parent')).toBe('parent');
    expect(said('child')).toBe('child');
    expect(said('grandparent')).toBe('grandparent');
    expect(said('grandchild')).toBe('grandchild');
    expect(said('aunt-uncle')).toBe('aunt or uncle');
    expect(said('niece-nephew')).toBe('niece or nephew');
    expect(said('sibling')).toBe('sibling');
    expect(said('partner')).toBe('partner');
  });

  test('friends answers become friendships; not met and family make no tie', () => {
    expect(said('met:college')).toBe('friend');
    expect(said(NOT_MET)).toBeNull();
    expect(said('family')).toBeNull();
  });

  test('every offered choice is understood', () => {
    for (const kind of ['family', 'friends', 'mixed'] as const)
      for (const c of threadChoicesFor(kind))
        if (c.id !== NOT_MET && c.id !== 'family')
          expect(tieFromAnswer('me', { about: 'them', choice: c.id }, 't'), c.id).not.toBeNull();
  });
});
