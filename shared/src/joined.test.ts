import { describe, expect, it } from 'vitest';
import { joinPeople, type SourcePeople, sourceOfKey } from './joined';
import type { Family, FamilyPerson } from './people';

const person = (id: string, extra: Partial<FamilyPerson> = {}): FamilyPerson => ({
  id,
  name: id[0]?.toUpperCase() + id.slice(1),
  participation: 'playing',
  ...extra,
});

const family = (ids: string[], ties: Family['ties'] = []): Family => ({
  version: 2,
  name: 'x',
  people: Object.fromEntries(ids.map((id) => [id, person(id)])),
  ties,
  households: {},
});

const smiths: SourcePeople = {
  circleId: 'smiths',
  family: family(
    ['alice', 'bob', 'carol'],
    [{ id: 't1', type: 'partner', a: 'alice', b: 'bob', kind: 'married' }],
  ),
  users: { alice: { isAdmin: true }, bob: {}, carol: {} },
  signIn: { 'alice@example.com': 'alice', 'bob@example.com': 'bob' },
};

const crew: SourcePeople = {
  circleId: 'crew',
  family: family(
    ['al', 'bob', 'dave'],
    [
      { id: 't1', type: 'friend', a: 'al', b: 'dave' },
      { id: 't2', type: 'friend', a: 'dave', b: 'al' },
    ],
  ),
  users: { al: { isAdmin: false }, bob: { isAdmin: true }, dave: {} },
  // Alice is "al" here; this bob is someone else.
  signIn: { 'ALICE@example.com ': 'al', 'other-bob@example.com': 'bob' },
};

describe('joinPeople', () => {
  const j = joinPeople('Everyone', [smiths, crew]);

  it('makes one person of the same sign-in in both circles', () => {
    expect(j.homes.alice).toEqual([
      { circleId: 'smiths', id: 'alice' },
      { circleId: 'crew', id: 'al' },
    ]);
    expect(j.family.people.al).toBeUndefined();
    expect(j.signIn['ALICE@example.com ']).toBe('alice');
  });

  it('keeps two different people with the same id apart', () => {
    expect(j.family.people.bob?.name).toBe('Bob');
    expect(j.family.people['bob-crew']).toMatchObject({ id: 'bob-crew' });
    expect(j.signIn['other-bob@example.com']).toBe('bob-crew');
  });

  it('carries ties across with the joined ids, once each', () => {
    const friends = j.family.ties.filter((t) => t.type === 'friend');
    expect(friends).toHaveLength(1);
    expect(friends[0]).toMatchObject({ a: 'alice', b: 'dave' });
    expect(j.family.ties.find((t) => t.type === 'partner')).toMatchObject({ a: 'alice', b: 'bob' });
  });

  it('is an admin here when an admin in any source', () => {
    expect(j.users.alice?.isAdmin).toBe(true);
    expect(j.users['bob-crew']?.isAdmin).toBe(true);
    expect(j.users.bob?.isAdmin).toBeUndefined();
  });

  it('points pictures at the circle they were made in', () => {
    const withPic: SourcePeople = {
      ...smiths,
      family: {
        ...smiths.family,
        people: {
          ...smiths.family.people,
          alice: person('alice', {
            photo: 'media/people/a.jpg',
            avatar: { library: 'ai', key: 'media/avatars/alice/1.jpg' },
          }),
        },
      },
    };
    const k = joinPeople('x', [withPic, crew]).family.people.alice;
    expect(k?.photo).toBe('media/from/smiths/people/a.jpg');
    expect(k?.avatar).toEqual({ library: 'ai', key: 'media/from/smiths/avatars/alice/1.jpg' });
    expect(sourceOfKey('media/from/smiths/people/a.jpg')).toEqual({
      circleId: 'smiths',
      key: 'media/people/a.jpg',
    });
  });

  it('includes people without a sign-in, like someone remembered', () => {
    expect(j.family.people.carol).toBeDefined();
    expect(Object.keys(j.family.people).sort()).toEqual([
      'alice',
      'bob',
      'bob-crew',
      'carol',
      'dave',
    ]);
  });
});
