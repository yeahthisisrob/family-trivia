import { describe, expect, it } from 'vitest';
import {
  joinPeople,
  maybeSame,
  ownAnswers,
  type SourcePeople,
  sharesInto,
  sourceOfKey,
  withSourceAnswers,
} from './joined';
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

describe('same person', () => {
  // Grandma Jo is remembered in both circles; neither has a sign-in for her.
  const withJo = (s: SourcePeople, id: string): SourcePeople => ({
    ...s,
    family: {
      ...s.family,
      people: { ...s.family.people, [id]: person(id, { name: 'Grandma Jo' }) },
    },
  });
  const a = withJo(smiths, 'jo');
  const b = withJo(crew, 'grandma');

  it('suggests the same name in two circles', () => {
    const j = joinPeople('x', [a, b]);
    expect(maybeSame([a, b], j, { same: [], notSame: [] })).toEqual([
      {
        a: { circleId: 'smiths', id: 'jo' },
        b: { circleId: 'crew', id: 'grandma' },
        name: 'Grandma Jo',
      },
    ]);
  });

  it('makes one person of an admin\'s "same person" link, and stops asking', () => {
    const link = { a: { circleId: 'smiths', id: 'jo' }, b: { circleId: 'crew', id: 'grandma' } };
    const j = joinPeople('x', [a, b], [link]);
    expect(j.homes.jo).toHaveLength(2);
    expect(j.family.people.grandma).toBeUndefined();
    expect(maybeSame([a, b], j, { same: [link], notSame: [] })).toEqual([]);
  });

  it('never asks again about a pair an admin said are different', () => {
    const pair = { a: { circleId: 'smiths', id: 'jo' }, b: { circleId: 'crew', id: 'grandma' } };
    expect(maybeSame([a, b], joinPeople('x', [a, b]), { same: [], notSame: [pair] })).toEqual([]);
  });

  it('two sign-ins are two people, whatever their names', () => {
    const bobs = maybeSame([smiths, crew], joinPeople('x', [smiths, crew]), {
      same: [],
      notSame: [],
    });
    expect(bobs).toEqual([]);
  });
});

describe('past answers seen from a joined circle', () => {
  const e = (answer: string, from?: { circleId: string; name: string }) => ({
    answer,
    ...(from && { from }),
  });

  it('shares from a family circle by default, never from friends unless chosen', () => {
    expect(sharesInto({}, 'al', { id: 'home', kind: 'family' })).toBe(true);
    expect(sharesInto({}, 'al', { id: 'crew', kind: 'friends' })).toBe(false);
    expect(sharesInto({ al: { crew: true } }, 'al', { id: 'crew', kind: 'friends' })).toBe(true);
    expect(sharesInto({ al: { home: false } }, 'al', { id: 'home', kind: 'family' })).toBe(false);
  });

  it("marks each source's answers, keeps the circle's own first, and never re-marks", () => {
    const merged = withSourceAnswers(
      [e('Ramen')],
      [
        {
          circleId: 'home',
          name: 'The Smiths',
          entries: [e('Pizza'), e('Old', { circleId: 'x', name: 'X' })],
        },
      ],
    );
    expect(merged).toEqual([e('Ramen'), e('Pizza', { circleId: 'home', name: 'The Smiths' })]);
    expect(ownAnswers(merged ?? [])).toEqual([e('Ramen')]);
  });

  it('is null when there is nothing anywhere', () => {
    expect(withSourceAnswers(null, [{ circleId: 'home', name: 'H', entries: null }])).toBeNull();
    expect(withSourceAnswers([], [])).toEqual([]);
  });
});
