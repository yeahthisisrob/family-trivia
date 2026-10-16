/**
 * Who has joined: anyone who has played at least once, and everyone the
 * family remembers. People added to the family who never signed in stay in
 * Admin › Family but are left out of everything the family sees, until the
 * day they play (docs/decisions/0009).
 */
import { type Family, isRemembered } from '@family-trivia/shared';
import { S3_PATHS } from '../../constants';
import { getJson } from '../s3';
import { loadFamily } from './roster';

/**
 * Accounts that have answered at least once (kept by submitAnswer and
 * app-init). Null before that record exists, so a new family never vanishes.
 */
export async function activatedIds(): Promise<Set<string> | null> {
  const stored = await getJson<Record<string, boolean>>(S3_PATHS.MEMBER_ACTIVATION);
  if (!stored) return null;
  return new Set(
    Object.entries(stored)
      .filter(([, on]) => on)
      .map(([id]) => id),
  );
}

export function joinedOf(family: Family, activated: Set<string> | null): Set<string> {
  return new Set(
    Object.values(family.people)
      .filter((p) => !activated || activated.has(p.id) || isRemembered(p))
      .map((p) => p.id),
  );
}

/** The family as the family sees it: only people who have joined, and the ties between them. */
export function joinedFamily(family: Family, joined: Set<string>): Family {
  return {
    ...family,
    people: Object.fromEntries(Object.entries(family.people).filter(([id]) => joined.has(id))),
    ties: family.ties.filter((t) =>
      t.type === 'parent'
        ? joined.has(t.parent) && joined.has(t.child)
        : joined.has(t.a) && joined.has(t.b),
    ),
    households: Object.fromEntries(
      Object.entries(family.households).map(([id, h]) => [
        id,
        { ...h, members: h.members.filter((m) => joined.has(m)) },
      ]),
    ),
  };
}

// biome-ignore lint/suspicious/noExplicitAny: the version 1 hierarchy is loosely typed where it's read
type LegacyShape = { family?: Record<string, any> };

/**
 * The same for the version 1 hierarchy the tree and timeline still read.
 * Someone the hierarchy names but who isn't in the family at all is kept.
 */
export function joinedHierarchy<H extends LegacyShape>(
  h: H,
  family: Family,
  joined: Set<string>,
): H {
  const hidden = (id: string) => id in family.people && !joined.has(id);
  const f = h.family;
  if (!f) return h;
  const mentions = (x: unknown) =>
    JSON.stringify(x)
      .match(/"([^"]+)"/g)
      ?.some((s) => hidden(s.slice(1, -1)));
  return {
    ...h,
    family: {
      ...f,
      people: Object.fromEntries(Object.entries(f.people ?? {}).filter(([id]) => !hidden(id))),
      groups: Object.fromEntries(
        Object.entries((f.groups ?? {}) as Record<string, { members?: string[] }>).map(
          ([id, g]) => [id, { ...g, members: (g.members ?? []).filter((m) => !hidden(m)) }],
        ),
      ),
      ...(Array.isArray(f.relationships)
        ? { relationships: f.relationships.filter((r) => !mentions(r)) }
        : {}),
    },
  };
}

/** The whole family, who has joined, and the family as the family sees it. */
export async function loadJoined() {
  const [family, activated] = await Promise.all([loadFamily(), activatedIds()]);
  const joined = joinedOf(family, activated);
  return { family, joined, visible: joinedFamily(family, joined) };
}

/** The version 1 hierarchy with only people who have joined. */
export async function visibleHierarchy<H extends LegacyShape | null>(h: H): Promise<H> {
  if (!h) return h;
  const { family, joined } = await loadJoined();
  return joinedHierarchy(h, family, joined);
}
