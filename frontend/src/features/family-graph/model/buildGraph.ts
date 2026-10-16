/**
 * Turn the family into nodes and links for the force graph. Pure: no React,
 * no drawing, so the rules for what connects to what are tested on their own.
 */
import type { Family } from '@family-trivia/shared';
import type { GraphData, GraphPerson } from '../api/graphApi';

export type LinkKind = 'partner' | 'former-partner' | 'parent' | 'kin' | 'household' | 'alike';

export interface GraphNode {
  id: string;
  kind: 'person' | 'household';
  label: string;
  person?: GraphPerson;
  /** Size: how much they've shared (facts and trivia answered). */
  weight: number;
}

export interface GraphLink {
  source: string;
  target: string;
  kind: LinkKind;
  /** 0..1, how strong the connection is (likeness only; ties are 1). */
  strength: number;
  /** Likeness: how many questions they answered alike. */
  count?: number;
}

export interface GraphOptions {
  ties: boolean;
  households: boolean;
  alike: boolean;
  /** Only draw likeness between people who answered alike at least this often. */
  minAlike: number;
}

export const DEFAULT_OPTIONS: GraphOptions = {
  ties: true,
  households: false,
  alike: true,
  minAlike: 3,
};

export function buildGraph(
  data: GraphData,
  opts: GraphOptions,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = data.people.map((p) => ({
    id: p.id,
    kind: 'person',
    label: p.name,
    person: p,
    weight: (p.activity?.facts ?? 0) + (p.activity?.trivia ?? 0) * 0.25,
  }));
  const ids = new Set(nodes.map((n) => n.id));
  const links: GraphLink[] = [];

  if (opts.ties) {
    for (const t of data.ties) {
      const [a, b] = t.type === 'parent' ? [t.parent, t.child] : [t.a, t.b];
      if (!ids.has(a) || !ids.has(b)) continue;
      const kind: LinkKind =
        t.type === 'partner'
          ? t.ended
            ? 'former-partner'
            : 'partner'
          : t.type === 'parent'
            ? 'parent'
            : 'kin';
      links.push({ source: a, target: b, kind, strength: 1 });
    }
  }

  if (opts.households) {
    for (const h of data.households) {
      const members = h.members.filter((m) => ids.has(m));
      if (!members.length) continue;
      const hid = `household:${h.id}`;
      nodes.push({ id: hid, kind: 'household', label: h.name, weight: members.length });
      for (const m of members)
        links.push({ source: hid, target: m, kind: 'household', strength: 0.5 });
    }
  }

  if (opts.alike) {
    for (const l of data.likenesses) {
      if (l.count < opts.minAlike || !ids.has(l.a) || !ids.has(l.b)) continue;
      links.push({ source: l.a, target: l.b, kind: 'alike', strength: l.strength, count: l.count });
    }
  }
  return { nodes, links };
}

/** The family object the shared kinship helpers expect. */
export const asFamily = (data: GraphData): Family => ({
  version: 2,
  name: '',
  people: Object.fromEntries(
    data.people.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        participation: p.participation,
        ...(p.remembered ? { memorial: { died: p.died ?? undefined } } : {}),
      },
    ]),
  ),
  ties: data.ties,
  households: Object.fromEntries(data.households.map((h) => [h.id, h])),
});

/** A person's strongest likenesses, most alike first. */
export const likenessesOf = (data: GraphData, id: string) =>
  data.likenesses
    .filter((l) => l.a === id || l.b === id)
    .map((l) => ({
      other: l.a === id ? l.b : l.a,
      count: l.count,
      strength: l.strength,
      examples: l.examples.map((e) => ({
        question: e.question,
        mine: l.a === id ? e.a : e.b,
        theirs: l.a === id ? e.b : e.a,
      })),
    }))
    .sort((x, y) => y.count - x.count);
