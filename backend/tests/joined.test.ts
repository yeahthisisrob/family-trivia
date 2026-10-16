vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { Family } from '@family-trivia/shared';
import { joinedFamily, joinedHierarchy, joinedOf } from '../services/family/joined';

const family: Family = {
  version: 2,
  name: 'The Example Family',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    sam: { id: 'sam', name: 'Uncle Sam', participation: 'not-playing' },
    grace: {
      id: 'grace',
      name: 'Grandma Grace',
      participation: 'not-playing',
      memorial: { died: '2024' },
    },
  },
  ties: [
    { id: 't1', type: 'kin', a: 'alice', b: 'sam', relation: 'sibling' },
    { id: 't2', type: 'parent', parent: 'grace', child: 'alice', kind: 'birth' },
  ],
  households: { h: { id: 'h', name: 'Home', members: ['alice', 'sam'] } },
};

test('someone who never played is left out until they do; the remembered stay', () => {
  const joined = joinedOf(family, new Set(['alice']));
  expect([...joined].sort()).toEqual(['alice', 'grace']);
  const seen = joinedFamily(family, joined);
  expect(Object.keys(seen.people)).not.toContain('sam');
  expect(seen.ties.map((t) => t.id)).toEqual(['t2']);
  expect(seen.households.h?.members).toEqual(['alice']);
});

test('before anyone has played, nobody is hidden', () => {
  expect(joinedOf(family, null).size).toBe(3);
});

test('the old hierarchy drops them from people, groups and relationships', () => {
  const h = {
    family: {
      people: { alice: {}, sam: {} },
      groups: { g: { name: 'G', members: ['alice', 'sam'] } },
      relationships: [
        { from: 'alice', to: 'sam' },
        { from: 'alice', to: 'zoe' },
      ],
    },
  };
  const out = joinedHierarchy(h, family, joinedOf(family, new Set(['alice'])));
  expect(Object.keys(out.family.people)).toEqual(['alice']);
  expect(out.family.groups.g.members).toEqual(['alice']);
  expect(out.family.relationships).toEqual([{ from: 'alice', to: 'zoe' }]);
});
