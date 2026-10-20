/**
 * The people of a joined circle (docs/decisions/0018), made from its source
 * circles each time they're read. Nothing is copied, so a change in a source
 * shows at once and splitting loses nothing.
 *
 * Someone with the same sign-in in two sources is one person here, and so
 * is anyone an admin has said is the same person (someone remembered in both
 * circles has no sign-in). Everyone else keeps their id; an id that two
 * different people share gets the circle's id after it.
 */
import type { Family, FamilyPerson, Household, Tie } from './people';

export interface SourcePeople {
  circleId: string;
  family: Family;
  /** config/users.json's users: id → account settings (isAdmin, color, ...). */
  users: Record<string, Record<string, unknown>>;
  /** config/google-auth-map.json: email → id. */
  signIn: Record<string, string>;
}

/** One person as a source circle knows them. */
export interface PersonIn {
  circleId: string;
  id: string;
}

/**
 * What an admin said about two people from different source circles
 * (config/same-people.json in the joined circle).
 */
export interface SamePeople {
  same: { a: PersonIn; b: PersonIn }[];
  /** Pairs an admin said are different people: never suggested again. */
  notSame: { a: PersonIn; b: PersonIn }[];
}

export interface JoinedPeople {
  family: Family;
  users: Record<string, Record<string, unknown>>;
  signIn: Record<string, string>;
  /** Where each joined id lives: one entry per source it's in. */
  homes: Record<string, { circleId: string; id: string }[]>;
}

const norm = (email: string) => email.trim().toLowerCase();

/**
 * A picture stays in the circle it was made in. Seen from a joined circle,
 * its key names that circle: media/x.jpg → media/from/{circleId}/x.jpg.
 */
export const fromSourceKey = (circleId: string, key: string): string =>
  key.startsWith('media/from/') ? key : `media/from/${circleId}/${key.slice('media/'.length)}`;

/** The source circle and its own key, for a key made by fromSourceKey. */
export function sourceOfKey(key: string): { circleId: string; key: string } | null {
  const m = /^media\/from\/([a-z0-9-]+)\/(.+)$/.exec(key);
  return m ? { circleId: m[1] as string, key: `media/${m[2]}` } : null;
}

function withPictures(p: FamilyPerson, circleId: string, id: string): FamilyPerson {
  const media = (k: string) => (k.startsWith('media/') ? fromSourceKey(circleId, k) : k);
  return {
    ...p,
    id,
    ...(p.photo && { photo: media(p.photo) }),
    ...(p.avatar?.library === 'ai' && { avatar: { ...p.avatar, key: media(p.avatar.key) } }),
  };
}

const tieKey = (t: Tie): string => {
  switch (t.type) {
    case 'parent':
      return `parent:${t.parent}>${t.child}`;
    case 'kin':
      return `kin:${[t.a, t.b].sort().join('|')}:${t.relation}`;
    default:
      return `${t.type}:${[t.a, t.b].sort().join('|')}`;
  }
};

function remapTie(t: Tie, id: (x: string) => string): Tie {
  return t.type === 'parent'
    ? { ...t, parent: id(t.parent), child: id(t.child) }
    : { ...t, a: id(t.a), b: id(t.b) };
}

/** The id itself, or with the circle after it when someone else has it. */
function freeId(id: string, circleId: string, taken: Record<string, unknown>): string {
  if (!taken[id]) return id;
  let candidate = `${id}-${circleId}`;
  for (let n = 2; taken[candidate]; n++) candidate = `${id}-${circleId}-${n}`;
  return candidate;
}

const homeKey = (p: PersonIn) => `${p.circleId}\u0000${p.id}`;

export function joinPeople(
  name: string,
  sources: SourcePeople[],
  links: SamePeople['same'] = [],
): JoinedPeople {
  const byEmail = new Map<string, string>();
  // Someone already placed, by where they live: for "same person" links.
  const byHome = new Map<string, string>();
  const linked = (p: PersonIn) =>
    links.flatMap((l) =>
      homeKey(l.a) === homeKey(p) ? [l.b] : homeKey(l.b) === homeKey(p) ? [l.a] : [],
    );
  const homes: JoinedPeople['homes'] = {};
  const people: Record<string, FamilyPerson> = {};
  const users: JoinedPeople['users'] = {};
  const signIn: Record<string, string> = {};
  const ties = new Map<string, Tie>();
  const households: Record<string, Household> = {};

  for (const s of sources) {
    const emailOf = new Map(Object.entries(s.signIn).map(([e, id]) => [id, norm(e)]));
    const local = new Map<string, string>();
    const ids = new Set([...Object.keys(s.family.people), ...Object.keys(s.users)]);

    for (const id of ids) {
      const email = emailOf.get(id);
      let joined = email ? byEmail.get(email) : undefined;
      joined ??= linked({ circleId: s.circleId, id })
        .map((other) => byHome.get(homeKey(other)))
        .find((x) => x !== undefined);
      if (!joined) joined = freeId(id, s.circleId, homes);
      local.set(id, joined);
      byHome.set(homeKey({ circleId: s.circleId, id }), joined);
      homes[joined] = [...(homes[joined] ?? []), { circleId: s.circleId, id }];
      if (email && !byEmail.has(email)) byEmail.set(email, joined);

      const person = s.family.people[id];
      if (person && !people[joined]) people[joined] = withPictures(person, s.circleId, joined);
      const account = s.users[id];
      if (account) {
        const before = users[joined];
        users[joined] = before
          ? { ...before, isAdmin: before.isAdmin === true || account.isAdmin === true }
          : { ...account };
      }
    }

    const to = (x: string) => local.get(x) ?? x;
    for (const [email, id] of Object.entries(s.signIn)) signIn[email] = to(id);
    for (const t of s.family.ties) {
      const tie = remapTie(t, to);
      const key = tieKey(tie);
      if (!ties.has(key)) ties.set(key, { ...tie, id: `${s.circleId}:${t.id}` });
    }
    for (const h of Object.values(s.family.households)) {
      const id = `${s.circleId}:${h.id}`;
      households[id] = { ...h, id, members: h.members.map(to) };
    }
  }

  return {
    family: { version: 2, name, people, ties: [...ties.values()], households },
    users,
    signIn,
    homes,
  };
}

const nameKey = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * People who might be one person: the same name in two source circles, not
 * already one here, and not both signed in (two sign-ins are two people).
 * Pairs an admin answered are left out.
 */
export function maybeSame(
  sources: SourcePeople[],
  joined: JoinedPeople,
  answered: SamePeople,
): { a: PersonIn; b: PersonIn; name: string }[] {
  const asked = new Set(
    [...answered.same, ...answered.notSame].flatMap(({ a, b }) => [
      `${homeKey(a)}|${homeKey(b)}`,
      `${homeKey(b)}|${homeKey(a)}`,
    ]),
  );
  const joinedId = new Map<string, string>();
  for (const [jid, homes] of Object.entries(joined.homes))
    for (const h of homes) joinedId.set(homeKey(h), jid);
  const signedIn = (circle: SourcePeople, id: string) => Object.values(circle.signIn).includes(id);

  const out: { a: PersonIn; b: PersonIn; name: string }[] = [];
  sources.forEach((sa, i) => {
    for (const sb of sources.slice(i + 1))
      for (const pa of Object.values(sa.family.people))
        for (const pb of Object.values(sb.family.people)) {
          if (nameKey(pa.name) !== nameKey(pb.name)) continue;
          const a = { circleId: sa.circleId, id: pa.id };
          const b = { circleId: sb.circleId, id: pb.id };
          if (joinedId.get(homeKey(a)) === joinedId.get(homeKey(b))) continue;
          if (signedIn(sa, pa.id) && signedIn(sb, pb.id)) continue;
          if (asked.has(`${homeKey(a)}|${homeKey(b)}`)) continue;
          out.push({ a, b, name: pa.name });
        }
  });
  return out;
}

// ── Past answers in a joined circle ─────────────────────────────

/**
 * Whose past answers a joined circle shows, by joined person and source
 * circle (config/sharing.json in the joined circle). Missing means the
 * default: shared from a family circle, kept out from any other.
 */
export type Sharing = Record<string, Record<string, boolean>>;

export const sharesInto = (
  sharing: Sharing,
  personId: string,
  source: { id: string; kind: string },
): boolean => sharing[personId]?.[source.id] ?? source.kind === 'family';

interface FromAnswers<E> {
  circleId: string;
  name: string;
  entries: E[] | null;
}

/**
 * Someone's answers seen from a joined circle: their own there, then what
 * they share from each source, each marked with the circle it came from.
 * Null when there are none at all.
 */
export function withSourceAnswers<E extends { from?: { circleId: string; name: string } }>(
  own: E[] | null,
  sources: FromAnswers<E>[],
): E[] | null {
  const mine = ownAnswers(own ?? []);
  const theirs = sources.flatMap((s) =>
    (s.entries ?? [])
      .filter((e) => !e.from)
      .map((e) => ({ ...e, from: { circleId: s.circleId, name: s.name } })),
  );
  return own === null && theirs.length === 0 ? null : [...mine, ...theirs];
}

/** The answers given in this circle, without any read through from another. */
export const ownAnswers = <E extends { from?: unknown }>(entries: E[]): E[] =>
  entries.filter((e) => !e.from);
