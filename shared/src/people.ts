/**
 * The family: people, the relationships between them, and the households they
 * belong to. See docs/decisions/0009-people-and-relationships.md.
 *
 * Only what can't be worked out is stored: a person, and direct edges between
 * two people (partner, parent, or a declared kinship when the people in
 * between aren't in the app). Siblings, steps, grandparents, cousins and
 * in-laws are derived here, in one place, so every feature agrees.
 *
 * Families change. A partnership can end, a person can step back from playing
 * and come back, and people who have died stay in the family, remembered.
 */

// ── People ───────────────────────────────────────────────────────────────

/** Whether someone takes part in the game. Separate from being in the family. */
export type Participation = 'playing' | 'paused' | 'not-playing';

/** How the family remembers someone who has died. Everything is optional. */
export interface Memorial {
  /** ISO date (YYYY-MM-DD), or just a year (YYYY). */
  died?: string;
  /** A few words the family chose, shown under their name. */
  dedication?: string;
  /** Key of a photo in the family's own storage. */
  photo?: string;
  /** Show them on the home page (the family's "in memory of"). */
  onHome?: boolean;
}

export interface FamilyPerson {
  id: string;
  /** What the family calls them: "Grandma Jo", "Uncle Sam". */
  name: string;
  fullName?: string;
  born?: { date?: string; place?: string };
  photo?: string;
  participation: Participation;
  /** Present when the person has died. */
  memorial?: Memorial;
  /** Opt out of being named in AI-written questions, summaries and stories. */
  noAiMentions?: boolean;
}

// ── Ties: how two people are connected ────────────────────────────────────────────────────────

export type PartnerKind = 'married' | 'partnered' | 'engaged';
export type PartnershipEnd = 'separated' | 'divorced' | 'widowed';
export type ParentKind = 'birth' | 'adoptive' | 'step' | 'foster' | 'guardian';

/**
 * Kinship stated directly, for when the people in between aren't in the app
 * (a cousin whose parents don't play). Directional ones read "a is the
 * <relation> of b": a is b's grandparent, a is b's aunt or uncle.
 */
export type DeclaredKin =
  | 'sibling'
  | 'cousin'
  | 'aunt-uncle'
  | 'grandparent'
  | 'in-law'
  | 'chosen-family'
  | 'friend';

export interface Partnership {
  id: string;
  type: 'partner';
  a: string;
  b: string;
  kind: PartnerKind;
  since?: string;
  /** Set when the partnership has ended. The history stays; it just isn't current. */
  ended?: { reason: PartnershipEnd; date?: string };
}

export interface Parenthood {
  id: string;
  type: 'parent';
  parent: string;
  child: string;
  kind: ParentKind;
  since?: string;
}

export interface Kinship {
  id: string;
  type: 'kin';
  a: string;
  b: string;
  relation: DeclaredKin;
}

export type Tie = Partnership | Parenthood | Kinship;

// ── Households ───────────────────────────────────────────────────────────

/**
 * A home or a branch of the family ("The Smiths", "Grandma's house"). Any
 * number of them, and a person can be in more than one (a child with two homes).
 */
export interface Household {
  id: string;
  name: string;
  description?: string;
  color?: string;
  members: string[];
}

export interface Family {
  version: 2;
  name: string;
  people: Record<string, FamilyPerson>;
  ties: Tie[];
  households: Record<string, Household>;
}

// ── Who's who ────────────────────────────────────────────────────────────

export const isRemembered = (p: FamilyPerson | undefined): boolean => !!p?.memorial;

/** Takes part in the game right now: playing and not remembered. */
export const isPlaying = (p: FamilyPerson | undefined): boolean =>
  !!p && p.participation === 'playing' && !p.memorial;

/** People who take part in the game right now. */
export const playingPeople = (f: Family): FamilyPerson[] =>
  Object.values(f.people).filter(isPlaying);

/** Everyone in the family, remembered people included. */
export const everyone = (f: Family): FamilyPerson[] => Object.values(f.people);

/** People the family remembers, most recent first. */
export const rememberedPeople = (f: Family): FamilyPerson[] =>
  Object.values(f.people)
    .filter(isRemembered)
    .sort((x, y) => (y.memorial?.died ?? '').localeCompare(x.memorial?.died ?? ''));

/** Households a person belongs to. */
export const householdsOf = (f: Family, id: string): Household[] =>
  Object.values(f.households).filter((h) => h.members.includes(id));

// ── Direct edges ─────────────────────────────────────────────────────────

const unique = (ids: string[]): string[] => [...new Set(ids)];
const BIOLOGICAL_OR_LEGAL: ParentKind[] = ['birth', 'adoptive'];

export function parentsOf(f: Family, id: string, kinds?: ParentKind[]): string[] {
  return unique(
    f.ties
      .filter(
        (r): r is Parenthood =>
          r.type === 'parent' && r.child === id && (!kinds || kinds.includes(r.kind)),
      )
      .map((r) => r.parent),
  );
}

export function childrenOf(f: Family, id: string, kinds?: ParentKind[]): string[] {
  return unique(
    f.ties
      .filter(
        (r): r is Parenthood =>
          r.type === 'parent' && r.parent === id && (!kinds || kinds.includes(r.kind)),
      )
      .map((r) => r.child),
  );
}

const partnershipsOf = (f: Family, id: string): Partnership[] =>
  f.ties.filter((r): r is Partnership => r.type === 'partner' && (r.a === id || r.b === id));

const otherIn = (r: { a: string; b: string }, id: string): string => (r.a === id ? r.b : r.a);

/** Partners now. A partnership that ended (separated, divorced, widowed) is not current. */
export const currentPartnersOf = (f: Family, id: string): string[] =>
  partnershipsOf(f, id)
    .filter((r) => !r.ended)
    .map((r) => otherIn(r, id));

/** Partnerships that ended, with how they ended. */
export const formerPartnersOf = (f: Family, id: string): { id: string; reason: PartnershipEnd }[] =>
  partnershipsOf(f, id)
    .filter((r) => r.ended)
    .map((r) => ({ id: otherIn(r, id), reason: (r.ended as { reason: PartnershipEnd }).reason }));

const declared = (f: Family, id: string, relation: DeclaredKin): Kinship[] =>
  f.ties.filter(
    (r): r is Kinship => r.type === 'kin' && r.relation === relation && (r.a === id || r.b === id),
  );

// ── Derived kinship ──────────────────────────────────────────────────────

export interface Siblings {
  /** Share every birth or adoptive parent that's known. */
  full: string[];
  /** Share exactly one birth or adoptive parent. */
  half: string[];
  /** Joined by a parent's partnership, not by a shared parent. */
  step: string[];
}

export function siblingsOf(f: Family, id: string): Siblings {
  const mine = parentsOf(f, id, BIOLOGICAL_OR_LEGAL);
  const full = new Set<string>();
  const half = new Set<string>();
  const step = new Set<string>();

  for (const p of mine) {
    for (const c of childrenOf(f, p, BIOLOGICAL_OR_LEGAL)) {
      if (c === id) continue;
      const theirs = parentsOf(f, c, BIOLOGICAL_OR_LEGAL);
      const shared = theirs.filter((x) => mine.includes(x)).length;
      const same = shared === mine.length && shared === theirs.length;
      (same ? full : half).add(c);
    }
  }
  // A step-sibling is the child of a parent's current partner, sharing no parent.
  for (const p of parentsOf(f, id)) {
    for (const partner of currentPartnersOf(f, p)) {
      for (const c of childrenOf(f, partner)) {
        if (c !== id && !full.has(c) && !half.has(c)) step.add(c);
      }
    }
  }
  for (const k of declared(f, id, 'sibling')) {
    const other = otherIn(k, id);
    if (!half.has(other) && !step.has(other)) full.add(other);
  }
  return { full: [...full], half: [...half], step: [...step] };
}

const allSiblings = (f: Family, id: string): string[] => {
  const s = siblingsOf(f, id);
  return [...s.full, ...s.half];
};

export const grandparentsOf = (f: Family, id: string): string[] =>
  unique([
    ...parentsOf(f, id).flatMap((p) => parentsOf(f, p)),
    ...declared(f, id, 'grandparent')
      .filter((k) => k.b === id)
      .map((k) => k.a),
  ]);

export const grandchildrenOf = (f: Family, id: string): string[] =>
  unique([
    ...childrenOf(f, id).flatMap((c) => childrenOf(f, c)),
    ...declared(f, id, 'grandparent')
      .filter((k) => k.a === id)
      .map((k) => k.b),
  ]);

export const auntsAndUnclesOf = (f: Family, id: string): string[] =>
  unique([
    ...parentsOf(f, id, BIOLOGICAL_OR_LEGAL).flatMap((p) => allSiblings(f, p)),
    ...declared(f, id, 'aunt-uncle')
      .filter((k) => k.b === id)
      .map((k) => k.a),
  ]);

export const niecesAndNephewsOf = (f: Family, id: string): string[] =>
  unique([
    ...allSiblings(f, id).flatMap((s) => childrenOf(f, s, BIOLOGICAL_OR_LEGAL)),
    ...declared(f, id, 'aunt-uncle')
      .filter((k) => k.a === id)
      .map((k) => k.b),
  ]);

export const cousinsOf = (f: Family, id: string): string[] =>
  unique([
    ...auntsAndUnclesOf(f, id).flatMap((a) => childrenOf(f, a, BIOLOGICAL_OR_LEGAL)),
    ...declared(f, id, 'cousin').map((k) => otherIn(k, id)),
  ]).filter((c) => c !== id);

// ── How two people are related ───────────────────────────────────────────

/**
 * What `other` is to `me`, in plain words: "partner", "former partner",
 * "stepparent", "half-sibling", "cousin", "sibling-in-law". Gender-neutral on
 * purpose. Null when the family doesn't connect them (yet).
 */
export function relationOf(f: Family, me: string, other: string): string | null {
  if (me === other) return 'self';
  if (currentPartnersOf(f, me).includes(other)) return 'partner';
  const former = formerPartnersOf(f, me).find((x) => x.id === other);
  if (former) return former.reason === 'widowed' ? 'late partner' : 'former partner';

  const parentEdge = f.ties.find(
    (r): r is Parenthood => r.type === 'parent' && r.child === me && r.parent === other,
  );
  if (parentEdge)
    return parentEdge.kind === 'birth' || parentEdge.kind === 'adoptive'
      ? 'parent'
      : parentEdge.kind === 'step'
        ? 'stepparent'
        : `${parentEdge.kind} parent`;
  if (parentsOf(f, me).some((p) => currentPartnersOf(f, p).includes(other))) return 'stepparent';

  const childEdge = f.ties.find(
    (r): r is Parenthood => r.type === 'parent' && r.parent === me && r.child === other,
  );
  if (childEdge)
    return childEdge.kind === 'step'
      ? 'stepchild'
      : childEdge.kind === 'birth' || childEdge.kind === 'adoptive'
        ? 'child'
        : `${childEdge.kind} child`;
  if (currentPartnersOf(f, me).some((p) => childrenOf(f, p).includes(other))) return 'stepchild';

  const sib = siblingsOf(f, me);
  if (sib.full.includes(other)) return 'sibling';
  if (sib.half.includes(other)) return 'half-sibling';
  if (sib.step.includes(other)) return 'stepsibling';

  if (grandparentsOf(f, me).includes(other)) return 'grandparent';
  if (grandchildrenOf(f, me).includes(other)) return 'grandchild';
  if (auntsAndUnclesOf(f, me).includes(other)) return 'aunt or uncle';
  if (niecesAndNephewsOf(f, me).includes(other)) return 'niece or nephew';
  if (cousinsOf(f, me).includes(other)) return 'cousin';

  // In-laws run through a current partner only.
  for (const partner of currentPartnersOf(f, me)) {
    if (parentsOf(f, partner).includes(other)) return 'parent-in-law';
    if (allSiblings(f, partner).includes(other)) return 'sibling-in-law';
  }
  for (const s of allSiblings(f, me))
    if (currentPartnersOf(f, s).includes(other)) return 'sibling-in-law';
  for (const c of childrenOf(f, me))
    if (currentPartnersOf(f, c).includes(other)) return 'child-in-law';

  const kin = f.ties.find(
    (r): r is Kinship =>
      r.type === 'kin' && ((r.a === me && r.b === other) || (r.a === other && r.b === me)),
  );
  if (kin) return kin.relation === 'chosen-family' ? 'chosen family' : kin.relation;

  return householdsOf(f, me).some((h) => h.members.includes(other)) ? 'family' : null;
}

/**
 * The relationships that may be mentioned when writing about a person: current
 * partners and family ties, never an ended partnership. Used to build AI
 * prompts, so a question never calls someone "married to" a former partner.
 */
export function mentionableRelations(
  f: Family,
  id: string,
): { id: string; name: string; relation: string }[] {
  return Object.values(f.people)
    .filter((p) => p.id !== id && !p.noAiMentions)
    .map((p) => ({ id: p.id, name: p.name, relation: relationOf(f, id, p.id) }))
    .filter(
      (r): r is { id: string; name: string; relation: string } =>
        !!r.relation && r.relation !== 'former partner' && r.relation !== 'family',
    );
}

// ── Reading the version 1 hierarchy ──────────────────────────────────────

/** The version 1 `family/hierarchy.json`: one root couple, two sides, groups. */
export interface LegacyHierarchy {
  family?: {
    name?: string;
    people?: Record<string, { id?: string; name?: string; groupId?: string }>;
    groups?: Record<
      string,
      { id?: string; name?: string; members?: string[]; description?: string }
    >;
    sides?: Record<string, { color?: string }>;
    relationships?: Array<Record<string, unknown>>;
  };
}

/**
 * Reads a version 1 hierarchy as a version 2 family, so existing families keep
 * working with no migration. Anyone with a player account is `playing`;
 * everyone else in the tree is `not-playing`.
 */
export function fromLegacyHierarchy(
  h: LegacyHierarchy | null | undefined,
  playerIds: string[],
): Family {
  const fam = h?.family ?? {};
  const people: Record<string, FamilyPerson> = {};
  const players = new Set(playerIds);
  for (const [id, p] of Object.entries(fam.people ?? {})) {
    people[id] = {
      id,
      name: p.name || id,
      participation: players.has(id) ? 'playing' : 'not-playing',
    };
  }
  for (const id of players) people[id] ??= { id, name: id, participation: 'playing' };

  const ties: Tie[] = [];
  let n = 0;
  const id = () => `r${++n}`;
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

  for (const r of fam.relationships ?? []) {
    switch (r.type) {
      case 'partners': {
        const a = str(r.partner1);
        const b = str(r.partner2);
        if (a && b) ties.push({ id: id(), type: 'partner', a, b, kind: 'partnered' });
        break;
      }
      case 'parents-of':
        for (const parent of [str(r.parent1), str(r.parent2)].filter((x): x is string => !!x)) {
          for (const child of list(r.children))
            ties.push({ id: id(), type: 'parent', parent, child, kind: 'birth' });
        }
        break;
      case 'cousins': {
        const a = str(r.person1);
        for (const b of list(r.people))
          if (a) ties.push({ id: id(), type: 'kin', a, b, relation: 'cousin' });
        break;
      }
      case 'aunt-of': {
        const a = str(r.aunt);
        for (const b of list(r['nieces-nephews']))
          if (a) ties.push({ id: id(), type: 'kin', a, b, relation: 'aunt-uncle' });
        break;
      }
    }
  }

  const households: Record<string, Household> = {};
  for (const [gid, g] of Object.entries(fam.groups ?? {})) {
    households[gid] = {
      id: gid,
      name: g.name || gid,
      ...(g.description ? { description: g.description } : {}),
      members: (g.members ?? []).filter((m) => m in people),
    };
  }
  return { version: 2, name: fam.name || 'Our family', people, ties, households };
}
