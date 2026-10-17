import type { FamilyKnowledge } from '@family-trivia/shared';
import { describe, expect, test } from 'vitest';
import { buildMap, hash01, RING } from './buildMap';

const knowledge = {
  themes: [
    {
      name: 'the beach',
      kind: 'place',
      people: ['carol', 'jo', 'alice'],
      quotes: [{ personId: 'jo', says: 'beach with cousins' }],
    },
    { name: 'apple pie', kind: 'food', people: ['bob', 'ivy'], quotes: [] },
    { name: 'secret spot', kind: 'place', people: ['carol', 'hidden'], quotes: [] },
  ],
  people: {
    carol: { top: [{ name: 'gardening', kind: 'activity', count: 4 }], persona: null, stats: {} },
    bob: { top: [{ name: 'once', kind: 'activity', count: 1 }], persona: null, stats: {} },
    hidden: { top: [{ name: 'nope', kind: 'food', count: 9 }], persona: null, stats: {} },
  },
  stats: {},
} as unknown as FamilyKnowledge;

const visible = new Set(['carol', 'jo', 'alice', 'bob', 'ivy', 'frank']);

describe('buildMap', () => {
  const map = buildMap(knowledge, visible);

  test('shared topics and strong personal ones, never what only hidden people say', () => {
    expect(map.topics.map((t) => t.name).sort()).toEqual(['apple pie', 'gardening', 'the beach']);
  });

  test('a territory per kind, in the index’s order', () => {
    expect(map.regions.map((r) => r.kind)).toEqual(['place', 'food', 'activity']);
  });

  test('topics on the ring; people inside it, drawn hardest to what few others share', () => {
    for (const t of map.topics)
      expect((t.x / RING.rx) ** 2 + (t.y / RING.ry) ** 2).toBeLessThan(1.05);
    const carol = map.people.find((p) => p.id === 'carol');
    const gardening = map.topics.find((t) => t.name === 'gardening');
    const pie = map.topics.find((t) => t.name === 'apple pie');
    const d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    // Gardening is Carol's alone; apple pie isn't hers at all.
    expect(carol && gardening && pie && d(carol.home, gardening) < d(carol.home, pie)).toBe(true);
  });

  test('people are stars, not topics; a name filed under two kinds appears once', () => {
    const k = {
      ...knowledge,
      themes: [
        ...knowledge.themes,
        { name: 'grandma', kind: 'person', people: ['carol', 'jo'], quotes: [] },
        { name: 'hanukkah', kind: 'value', people: ['carol', 'jo', 'bob'], quotes: [] },
        { name: 'hanukkah', kind: 'activity', people: ['alice', 'jo'], quotes: [] },
        { name: 'cats', kind: 'pet', people: ['carol', 'jo', 'bob'], quotes: [] },
        { name: 'cat', kind: 'pet', people: ['alice', 'ivy'], quotes: [] },
      ],
    } as unknown as FamilyKnowledge;
    const m = buildMap(k, visible);
    expect(m.topics.some((t) => t.name === 'grandma')).toBe(false);
    const hanukkah = m.topics.filter((t) => t.name === 'hanukkah');
    expect(hanukkah).toHaveLength(1);
    expect(hanukkah[0]).toMatchObject({ kind: 'value' });
    expect(hanukkah[0]?.people.sort()).toEqual(['alice', 'bob', 'carol', 'jo']);
    const cats = m.topics.filter((t) => t.name === 'cats' || t.name === 'cat');
    expect(cats.map((t) => t.name)).toEqual(['cats']);
    expect(cats[0]?.people).toHaveLength(5);
  });

  test('someone with nothing on the map yet waits near the middle', () => {
    const frank = map.people.find((p) => p.id === 'frank');
    expect(frank?.topics).toEqual([]);
    expect(Math.hypot(frank?.home.x ?? 999, frank?.home.y ?? 999)).toBeLessThan(200);
  });

  test('the same family lands in the same places', () => {
    expect(buildMap(knowledge, visible)).toEqual(map);
    expect(hash01('carol')).toBe(hash01('carol'));
  });
});
