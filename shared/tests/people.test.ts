import { describe, expect, test } from 'vitest';
import {
  cousinsOf,
  currentPartnersOf,
  type Family,
  type FamilyPerson,
  familyProblems,
  formerPartnersOf,
  fromLegacyHierarchy,
  grandparentsOf,
  isPlaying,
  mentionableRelations,
  playingPeople,
  relationOf,
  rememberedPeople,
  siblingsOf,
  type Tie,
} from '../src/people';

// A made-up blended family (docs/decisions/0006: never a real one).
//
//   grace (died 2024) ── ruth's mother
//   alice ═╪═ bob        separated; children carol, dave
//   bob ═══ erin         remarried; erin's child frank (from before), and baby gus with bob
//   alice ═══ hal        alice's new partner
//   ivy is bob's sister; jo is ivy's child (carol's cousin)
//   kit is declared carol's cousin directly (their parents aren't in the app)
const person = (id: string, extra: Partial<FamilyPerson> = {}): FamilyPerson => ({
  id,
  name: id[0]?.toUpperCase() + id.slice(1),
  participation: 'playing',
  ...extra,
});

let n = 0;
const parent = (p: string, child: string, kind: 'birth' | 'step' | 'adoptive' = 'birth'): Tie => ({
  id: `t${++n}`,
  type: 'parent',
  parent: p,
  child,
  kind,
});

const family: Family = {
  version: 2,
  name: 'The Example Family',
  people: Object.fromEntries(
    [
      person('grace', { memorial: { died: '2024-03-01', dedication: 'Always in the garden' } }),
      person('nan'),
      person('alice'),
      person('bob'),
      person('erin'),
      person('hal', { participation: 'paused' }),
      person('carol'),
      person('dave'),
      person('frank'),
      person('gus', { participation: 'not-playing' }),
      person('ivy'),
      person('jo'),
      person('kit', { noAiMentions: true }),
    ].map((p) => [p.id, p]),
  ),
  ties: [
    {
      id: 'p1',
      type: 'partner',
      a: 'alice',
      b: 'bob',
      kind: 'married',
      ended: { reason: 'divorced', date: '2022' },
    },
    { id: 'p2', type: 'partner', a: 'bob', b: 'erin', kind: 'married', since: '2023' },
    { id: 'p3', type: 'partner', a: 'alice', b: 'hal', kind: 'partnered' },
    parent('grace', 'bob'),
    parent('nan', 'bob'),
    parent('grace', 'ivy'),
    parent('nan', 'ivy'),
    parent('alice', 'carol'),
    parent('bob', 'carol'),
    parent('alice', 'dave'),
    parent('bob', 'dave'),
    parent('erin', 'frank'),
    parent('bob', 'gus'),
    parent('erin', 'gus'),
    parent('ivy', 'jo'),
    { id: 'k1', type: 'kin', a: 'kit', b: 'carol', relation: 'cousin' },
  ],
  households: {
    mom: { id: 'mom', name: "Mom's house", members: ['alice', 'hal', 'carol', 'dave'] },
    dad: {
      id: 'dad',
      name: "Dad's house",
      members: ['bob', 'erin', 'frank', 'gus', 'carol', 'dave'],
    },
  },
};

describe('who plays and who is remembered', () => {
  test('remembered people never play, paused and not-playing people sit out', () => {
    expect(isPlaying(family.people.grace)).toBe(false);
    expect(isPlaying(family.people.hal)).toBe(false);
    expect(isPlaying(family.people.gus)).toBe(false);
    expect(playingPeople(family).map((p) => p.id)).not.toContain('grace');
    expect(rememberedPeople(family).map((p) => p.id)).toEqual(['grace']);
  });
});

describe('partnerships change over time', () => {
  test('an ended partnership is not current, and keeps how it ended', () => {
    expect(currentPartnersOf(family, 'alice')).toEqual(['hal']);
    expect(currentPartnersOf(family, 'bob')).toEqual(['erin']);
    expect(formerPartnersOf(family, 'alice')).toEqual([{ id: 'bob', reason: 'divorced' }]);
  });
});

describe('derived kinship', () => {
  test('full, half and step siblings in a blended family', () => {
    expect(siblingsOf(family, 'carol')).toEqual({ full: ['dave'], half: ['gus'], step: ['frank'] });
    expect(siblingsOf(family, 'frank')).toEqual({
      full: [],
      half: ['gus'],
      step: ['carol', 'dave'],
    });
  });

  test('grandparents through either parent, remembered ones included', () => {
    expect(grandparentsOf(family, 'carol').sort()).toEqual(['grace', 'nan']);
  });

  test('cousins derived through an aunt and declared directly', () => {
    expect(cousinsOf(family, 'carol').sort()).toEqual(['jo', 'kit']);
  });
});

describe('relationOf says what someone is to me', () => {
  test.each([
    ['carol', 'alice', 'parent'],
    ['carol', 'erin', 'stepparent'],
    ['carol', 'hal', 'stepparent'],
    ['carol', 'frank', 'stepsibling'],
    ['carol', 'gus', 'half-sibling'],
    ['carol', 'dave', 'sibling'],
    ['carol', 'grace', 'grandparent'],
    ['carol', 'ivy', 'aunt or uncle'],
    ['carol', 'jo', 'cousin'],
    ['carol', 'kit', 'cousin'],
    ['alice', 'bob', 'former partner'],
    ['alice', 'hal', 'partner'],
    ['erin', 'nan', 'parent-in-law'],
    ['erin', 'ivy', 'sibling-in-law'],
    ['erin', 'frank', 'child'],
    ['bob', 'frank', 'stepchild'],
  ])('%s → %s is %s', (me, other, expected) => {
    expect(relationOf(family, me, other)).toBe(expected);
  });

  test("an ex is not an in-law: an ex-partner's parents are not called in-laws", () => {
    expect(relationOf(family, 'alice', 'nan')).toBeNull();
  });
});

describe('what AI may mention about someone', () => {
  test('never a former partner, never someone who opted out', () => {
    const names = mentionableRelations(family, 'alice').map((r) => r.id);
    expect(names).toContain('hal');
    expect(names).toContain('carol');
    expect(names).not.toContain('bob');
    expect(mentionableRelations(family, 'carol').map((r) => r.id)).not.toContain('kit');
  });
});

describe('reading a version 1 hierarchy', () => {
  test('converts partners, parents, cousins and aunts; accounts decide who plays', () => {
    const f = fromLegacyHierarchy(
      {
        family: {
          name: 'Legacy',
          people: {
            a: { name: 'A' },
            b: { name: 'B' },
            c: { name: 'C' },
            d: { name: 'D' },
            e: { name: 'E' },
          },
          groups: { g: { name: 'G', members: ['a', 'b', 'c', 'zz'] } },
          relationships: [
            { type: 'partners', partner1: 'a', partner2: 'b' },
            { type: 'parents-of', parent1: 'a', parent2: 'b', children: ['c'] },
            { type: 'cousins', person1: 'c', people: ['d'] },
            { type: 'aunt-of', aunt: 'e', 'nieces-nephews': ['c'] },
          ],
        },
      },
      ['a', 'c'],
    );
    expect(f.people.a?.participation).toBe('playing');
    expect(f.people.b?.participation).toBe('not-playing');
    expect(relationOf(f, 'c', 'a')).toBe('parent');
    expect(relationOf(f, 'a', 'b')).toBe('partner');
    expect(relationOf(f, 'c', 'd')).toBe('cousin');
    expect(relationOf(f, 'c', 'e')).toBe('aunt or uncle');
    expect(f.households.g?.members).toEqual(['a', 'b', 'c']);
  });
});

describe('familyProblems', () => {
  test('the example family is valid', () => {
    expect(familyProblems(family)).toEqual([]);
  });

  test('catches ties to missing people, self ties, bad dates and nameless people', () => {
    const broken: Family = {
      ...family,
      people: {
        ...family.people,
        zed: { id: 'zed', name: ' ', participation: 'playing', born: { date: '5/1/80' } },
      },
      ties: [
        ...family.ties,
        { id: 'x1', type: 'kin', a: 'carol', b: 'nobody', relation: 'cousin' },
        { id: 'x2', type: 'partner', a: 'dave', b: 'dave', kind: 'married' },
      ],
    };
    const problems = familyProblems(broken).join('\n');
    expect(problems).toContain('needs a name');
    expect(problems).toContain('YYYY-MM-DD');
    expect(problems).toContain("isn't in the family");
    expect(problems).toContain('to themselves');
  });
});
