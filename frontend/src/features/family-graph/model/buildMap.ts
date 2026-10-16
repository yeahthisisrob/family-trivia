/**
 * Our map: what the family talks about, laid out like a map of territories.
 * Topics from the family's index sit on a wide oval, one arc per kind
 * (places, food, things we do…), each kind a territory. Every person is a
 * star pulled toward the topics they talk about, so people who love the same
 * things end up near each other. Pure: no React, no drawing, and the same
 * family always lands in the same places.
 */
import { type FamilyKnowledge, KNOWLEDGE_KINDS, type KnowledgeKind } from '@family-trivia/shared';

export interface MapTopic {
  id: string;
  name: string;
  kind: KnowledgeKind;
  /** How many people talk about it, or how often one person does. */
  weight: number;
  people: string[];
  quotes: { personId: string; says: string }[];
  x: number;
  y: number;
}

export interface MapPerson {
  id: string;
  /** Where they belong on the map: the middle of what they talk about. */
  home: { x: number; y: number };
  topics: string[];
}

export interface MapRegion {
  kind: KnowledgeKind;
  label: string;
  /** Where its name is written, outside the ring. */
  x: number;
  y: number;
  /** Middle of the arc, for its colored ground. */
  angle: number;
}

export interface FamilyMapData {
  topics: MapTopic[];
  people: MapPerson[];
  links: { source: string; target: string; strength: number }[];
  regions: MapRegion[];
}

export const RING = { rx: 620, ry: 380 };

/** The ring's shape for a view: wide on a wide screen, tall on a phone. */
export const ringFor = (width: number, height: number) => {
  const aspect = Math.min(2.2, Math.max(0.5, width / Math.max(1, height)));
  return { rx: 480 * Math.sqrt(aspect), ry: 480 / Math.sqrt(aspect) };
};
/** Most topics on the map; the rest of a long tail just crowds it. */
const MAX_TOPICS = 64;
/** A person's own topics, beyond the shared ones. */
const OWN_TOPICS = 3;

/** FNV-1a: a stable 0..1 from a string, so layouts don't move between visits. */
export function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0xffffffff;
}

const topicId = (kind: string, name: string) => `topic:${kind}:${name}`;

export function buildMap(
  knowledge: FamilyKnowledge,
  visible: Set<string>,
  ring: { rx: number; ry: number } = RING,
): FamilyMapData {
  // Shared themes first, then each person's strongest topics of their own.
  const byId = new Map<string, Omit<MapTopic, 'x' | 'y'>>();
  for (const t of knowledge.themes) {
    const people = t.people.filter((p) => visible.has(p));
    if (people.length < 2) continue;
    byId.set(topicId(t.kind, t.name), {
      id: topicId(t.kind, t.name),
      name: t.name,
      kind: t.kind,
      weight: people.length,
      people,
      quotes: t.quotes.filter((q) => visible.has(q.personId)),
    });
  }
  for (const [personId, k] of Object.entries(knowledge.people)) {
    if (!visible.has(personId)) continue;
    for (const item of k.top.slice(0, OWN_TOPICS)) {
      const id = topicId(item.kind, item.name);
      const had = byId.get(id);
      if (had) {
        if (!had.people.includes(personId)) had.people.push(personId);
      } else if (item.count >= 2)
        byId.set(id, {
          id,
          name: item.name,
          kind: item.kind,
          weight: Math.min(item.count / 2, 2),
          people: [personId],
          quotes: [],
        });
    }
  }
  const chosen = [...byId.values()]
    .sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))
    .slice(0, MAX_TOPICS);

  // One arc per kind, as wide as its share of the topics, in the index's order.
  const kinds = KNOWLEDGE_KINDS.filter((k) => chosen.some((t) => t.kind === k.id));
  const total = chosen.length || 1;
  const regions: MapRegion[] = [];
  const topics: MapTopic[] = [];
  let start = -Math.PI / 2;
  for (const k of kinds) {
    const mine = chosen.filter((t) => t.kind === k.id).sort((a, b) => a.name.localeCompare(b.name));
    const span = (mine.length / total) * Math.PI * 2;
    const mid = start + span / 2;
    regions.push({
      kind: k.id,
      label: k.label,
      angle: mid,
      x: Math.cos(mid) * ring.rx * 1.12,
      y: Math.sin(mid) * ring.ry * 1.18,
    });
    mine.forEach((t, i) => {
      const a = start + span * ((i + 0.5) / mine.length);
      // Shared topics sit nearer the middle; a little jitter keeps it organic.
      const depth = 0.72 + 0.22 * hash01(t.id) + (t.weight >= 3 ? -0.1 : 0.06);
      topics.push({ ...t, x: Math.cos(a) * ring.rx * depth, y: Math.sin(a) * ring.ry * depth });
    });
    start += span;
  }

  const spot = new Map(topics.map((t) => [t.id, t]));
  const people: MapPerson[] = [...visible].map((id, i) => {
    const mine = topics.filter((t) => t.people.includes(id));
    if (!mine.length) {
      // Nothing on the map yet: a quiet spot near the middle (golden angle).
      const a = i * 2.39996;
      const r = 60 + 14 * Math.sqrt(i);
      return { id, topics: [], home: { x: Math.cos(a) * r, y: Math.sin(a) * r } };
    }
    let wx = 0;
    let wy = 0;
    let w = 0;
    for (const t of mine) {
      const weight = t.people.length > 1 ? 2 : 1;
      wx += t.x * weight;
      wy += t.y * weight;
      w += weight;
    }
    // Pulled inward, so people sit inside the ring of what they love.
    const pull = 0.78;
    const jitter = (hash01(id) - 0.5) * 40;
    return {
      id,
      topics: mine.map((t) => t.id),
      home: { x: (wx / w) * pull + jitter, y: (wy / w) * pull - jitter / 2 },
    };
  });

  const links = people.flatMap((p) =>
    p.topics.map((t) => ({
      source: p.id,
      target: t,
      strength: (spot.get(t)?.people.length ?? 1) > 1 ? 1 : 0.6,
    })),
  );
  return { topics, people, links, regions };
}
