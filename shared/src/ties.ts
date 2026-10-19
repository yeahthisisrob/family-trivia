/**
 * The tie registry (docs/decisions/0021): every kind of tie two people can
 * have, what it's called, and which circles offer it. Family and friends
 * share one model; a circle's kind only decides which ties are offered first
 * when adding one, never what can be stored or read.
 */

import type { CircleKind } from './circle';
import type {
  DeclaredKin,
  Friendship,
  MetHow,
  ParentKind,
  PartnerKind,
  PartnershipEnd,
  Tie,
} from './people';

export const PARTNER_LABEL: Record<PartnerKind, string> = {
  married: 'Married',
  partnered: 'Partners',
  engaged: 'Engaged',
};

export const ENDED_LABEL: Record<PartnershipEnd, string> = {
  separated: 'Separated',
  divorced: 'Divorced',
  widowed: 'Widowed',
};

export const PARENT_LABEL: Record<ParentKind, string> = {
  birth: 'Parent',
  adoptive: 'Adoptive parent',
  step: 'Stepparent',
  foster: 'Foster parent',
  guardian: 'Guardian',
};

export const KIN_LABEL: Record<DeclaredKin, string> = {
  sibling: 'Sibling',
  cousin: 'Cousin',
  'aunt-uncle': 'Aunt or uncle of',
  grandparent: 'Grandparent of',
  'in-law': 'In-law',
  'chosen-family': 'Chosen family',
  friend: 'Friend',
};

/** Where two friends found each other. "Met at work", "met through a friend". */
export const MET_LABEL: Record<MetHow, string> = {
  school: 'at school',
  college: 'in college',
  work: 'at work',
  neighbors: 'as neighbors',
  team: 'on a team',
  'through-a-friend': 'through a friend',
  online: 'online',
  family: 'through family',
  other: 'somewhere else',
};

const keys = <K extends string>(r: Record<K, string>) => Object.keys(r) as K[];
export const PARTNER_KINDS = keys(PARTNER_LABEL);
export const ENDINGS = keys(ENDED_LABEL);
export const PARENT_KINDS = keys(PARENT_LABEL);
export const KIN_RELATIONS = keys(KIN_LABEL);
export const MET_HOWS = keys(MET_LABEL);

/** The two people a tie connects. */
export const tieEnds = (t: Tie): [string, string] =>
  t.type === 'parent' ? [t.parent, t.child] : [t.a, t.b];

/** Whether a tie touches this person. */
export const tieTouches = (t: Tie, id: string): boolean => tieEnds(t).includes(id);

// ── Adding a tie ─────────────────────────────────────────────────────────

export type TieChoice = 'friend' | 'partner' | 'parent' | 'child' | 'kin';

/** What "Add" offers, in order. A mixed circle offers everything. */
export const TIE_CHOICES: { id: TieChoice; label: string; offeredIn: CircleKind[] }[] = [
  { id: 'friend', label: 'A friend', offeredIn: ['friends', 'mixed'] },
  { id: 'partner', label: 'A partner', offeredIn: ['family', 'friends', 'mixed'] },
  { id: 'parent', label: 'A parent', offeredIn: ['family', 'mixed'] },
  { id: 'child', label: 'A child', offeredIn: ['family', 'mixed'] },
  { id: 'kin', label: 'Other family', offeredIn: ['family', 'friends', 'mixed'] },
];

export const tieChoicesFor = (kind: CircleKind) =>
  TIE_CHOICES.filter((c) => c.offeredIn.includes(kind));

/** A new tie from `me` to `other`, with the plainest defaults. */
export function newTie(choice: TieChoice, me: string, other: string, id: string): Tie {
  switch (choice) {
    case 'friend':
      return { id, type: 'friend', a: me, b: other };
    case 'partner':
      return { id, type: 'partner', a: me, b: other, kind: 'partnered' };
    case 'parent':
      return { id, type: 'parent', parent: other, child: me, kind: 'birth' };
    case 'child':
      return { id, type: 'parent', parent: me, child: other, kind: 'birth' };
    case 'kin':
      return { id, type: 'kin', a: me, b: other, relation: 'cousin' };
  }
}

/** How two friends met, in a few words: "met in college, 2004, in Springfield". */
export function metLine(t: Friendship): string | null {
  const m = t.met;
  if (!m?.how && !m?.when && !m?.where) return null;
  return [
    m.how ? `met ${MET_LABEL[m.how]}` : 'met',
    m.when ? m.when.slice(0, 4) : null,
    m.where ? `in ${m.where}` : null,
  ]
    .filter(Boolean)
    .join(', ');
}
