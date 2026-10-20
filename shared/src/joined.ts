/**
 * The people of a joined circle (docs/decisions/0018), made from its source
 * circles each time they're read. Nothing is copied, so a change in a source
 * shows at once and splitting loses nothing.
 *
 * Someone with the same sign-in in two sources is one person here. Everyone
 * else keeps their id; an id that two different people share gets the
 * circle's id after it.
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

export function joinPeople(name: string, sources: SourcePeople[]): JoinedPeople {
  const byEmail = new Map<string, string>();
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
      if (!joined) joined = freeId(id, s.circleId, homes);
      local.set(id, joined);
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
