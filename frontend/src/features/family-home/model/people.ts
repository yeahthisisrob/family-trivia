/**
 * The people on the Family tab, ready to show: how each relates to the
 * person looking, their homes, a few numbers, and who is in today's
 * spotlight. Pure, so the rules are tested on their own.
 */
import {
  type CircleKind,
  type Family,
  isRemembered,
  relationOf,
  relationWord,
  wordsFor,
} from '@family-trivia/shared';
import type { GraphData } from '../../../entities/family';

export interface PersonView {
  id: string;
  name: string;
  relation: string | null;
  homes: { id: string; name: string }[];
  remembered: boolean;
  died: string | null;
  paused: boolean;
  notPlaying: boolean;
  facts: number;
  accuracy: number | null;
  sinceYear: string | null;
}

/** Relation words for the person looking: "your cousin", or a name's role. */
export const relationLabel = (
  relation: string | null,
  isMe: boolean,
  kind: CircleKind = 'family',
): string =>
  isMe
    ? 'you'
    : relation === 'family'
      ? relationWord(relation, kind)
      : relation
        ? `your ${relation}`
        : wordsFor(kind).someone;

export function peopleFor(data: GraphData, family: Family, meId: string | null): PersonView[] {
  return data.people.map((p) => {
    const a = p.activity;
    return {
      id: p.id,
      name: p.name,
      relation: meId && meId !== p.id ? relationOf(family, meId, p.id) : null,
      homes: data.households
        .filter((h) => h.members.includes(p.id))
        .map((h) => ({ id: h.id, name: h.name })),
      remembered: p.remembered,
      died: p.died,
      paused: p.participation === 'paused' && !p.remembered,
      notPlaying: p.participation === 'not-playing' && !p.remembered,
      facts: a?.facts ?? 0,
      accuracy: a?.trivia ? Math.round(((a.correct ?? 0) / a.trivia) * 100) : null,
      sinceYear: a?.since?.slice(0, 4) ?? null,
    };
  });
}

/** Closest first: partners, parents, children, siblings, then the rest by name. */
const CLOSENESS = [
  'partner',
  'parent',
  'child',
  'sibling',
  'stepparent',
  'stepchild',
  'half-sibling',
  'stepsibling',
  'grandparent',
  'grandchild',
];
export function sortForMe(people: PersonView[], meId: string | null): PersonView[] {
  const rank = (p: PersonView) =>
    p.id === meId ? -1 : p.relation ? CLOSENESS.indexOf(p.relation) + 1 || 50 : 99;
  return [...people].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/**
 * Who is in the spotlight today: everyone who has shared something takes a
 * turn, the same person all day for everyone, remembered people included.
 */
export function spotlightOf(
  people: PersonView[],
  day = new Date(),
): { today: PersonView | null; tomorrow: PersonView | null } {
  const pool = people.filter((p) => p.facts > 0).sort((a, b) => a.id.localeCompare(b.id));
  if (!pool.length) return { today: null, tomorrow: null };
  const n = Math.floor(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / 86_400_000);
  return { today: pool[n % pool.length] ?? null, tomorrow: pool[(n + 1) % pool.length] ?? null };
}

export const rememberedOf = (family: Family) => Object.values(family.people).filter(isRemembered);
