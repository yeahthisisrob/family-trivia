import { describe, expect, test } from 'vitest';
import type { GraphData } from '../api/graphApi';
import { buildGraph, DEFAULT_OPTIONS, likenessesOf } from './buildGraph';

const data: GraphData = {
  people: [
    {
      id: 'alice',
      name: 'Alice',
      participation: 'playing',
      remembered: false,
      died: null,
      activity: { facts: 10, trivia: 40 },
    },
    { id: 'bob', name: 'Bob', participation: 'playing', remembered: false, died: null },
    { id: 'grace', name: 'Grace', participation: 'not-playing', remembered: true, died: '2024' },
  ],
  ties: [
    {
      id: 't1',
      type: 'partner',
      a: 'alice',
      b: 'bob',
      kind: 'married',
      ended: { reason: 'divorced' },
    },
    { id: 't2', type: 'parent', parent: 'grace', child: 'alice', kind: 'birth' },
  ],
  households: [{ id: 'h', name: 'Home', members: ['alice', 'grace'] }],
  likenesses: [
    {
      a: 'alice',
      b: 'bob',
      count: 5,
      strength: 0.2,
      examples: [{ question: 'Q', a: 'beach', b: 'the beach' }],
    },
    { a: 'bob', b: 'grace', count: 1, strength: 0.05, examples: [] },
  ],
};

describe('buildGraph', () => {
  test('ties keep their meaning: an ended partnership is drawn as former', () => {
    const { links } = buildGraph(data, DEFAULT_OPTIONS);
    expect(links.find((l) => l.kind === 'former-partner')).toMatchObject({
      source: 'alice',
      target: 'bob',
    });
    expect(links.find((l) => l.kind === 'parent')).toMatchObject({
      source: 'grace',
      target: 'alice',
    });
  });

  test('weak likeness is hidden below the minimum', () => {
    const { links } = buildGraph(data, { ...DEFAULT_OPTIONS, minAlike: 3 });
    expect(links.filter((l) => l.kind === 'alike')).toHaveLength(1);
  });

  test('households become hubs when shown', () => {
    const { nodes, links } = buildGraph(data, { ...DEFAULT_OPTIONS, households: true });
    expect(nodes.find((n) => n.id === 'household:h')?.kind).toBe('household');
    expect(links.filter((l) => l.kind === 'household')).toHaveLength(2);
  });

  test("likenessesOf reads examples from the person's side", () => {
    expect(likenessesOf(data, 'bob')[0]).toMatchObject({
      other: 'alice',
      examples: [{ mine: 'the beach', theirs: 'beach' }],
    });
  });
});
