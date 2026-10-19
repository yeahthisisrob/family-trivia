/**
 * Memory links (docs/decisions/0027). A link lives outside any circle
 * (memory-links/{token}.json), since it's opened without signing in; the
 * memories it brings live in the circle, with the person they remember
 * (remembering/{personId}/visitors.json), waiting until an admin lets them in.
 */
import { randomBytes } from 'node:crypto';
import {
  INVITE_LIFETIMES,
  type InviteState,
  MEMORY_MAX,
  type MemoryLink,
  type MemoryLinkLifetime,
  type MemoryLinkPreview,
  type VisitorMemory,
} from '@family-trivia/shared';
import { findCircle, scopeOf } from '../../services/circles';
import { loadFamily } from '../../services/family/roster';
import { getJson, listObjects, putJson } from '../../services/s3';
import { inCircle } from '../../services/scope';

const TOKEN = /^[A-Za-z0-9_-]{22}$/;
const linkKey = (token: string) => `memory-links/${token}.json`;
const visitorsKey = (personId: string) => `remembering/${personId}/visitors.json`;
const DAY_MS = 86_400_000;
/** No more than this many memories wait at once for one person. */
const WAITING_MAX = 100;

const stateOf = (l: MemoryLink): InviteState =>
  l.revokedAt ? 'revoked' : l.expiresAt && new Date(l.expiresAt) <= new Date() ? 'expired' : 'open';

const readLink = async (token: string) =>
  TOKEN.test(token) ? getJson<MemoryLink>(linkKey(token)) : null;

interface Visitors {
  memories: VisitorMemory[];
}
const readVisitors = async (personId: string): Promise<Visitors> =>
  (await getJson<Visitors>(visitorsKey(personId))) ?? { memories: [] };

/** Someone the circle remembers, or null. */
async function remembered(personId: string) {
  const p = (await loadFamily()).people[personId];
  return p?.memorial ? p : null;
}

export async function createLink(input: {
  circleId: string;
  personId: string;
  lifetime: MemoryLinkLifetime;
  createdBy: string;
}): Promise<MemoryLink | null> {
  if (!(await remembered(input.personId))) return null;
  const days = INVITE_LIFETIMES[input.lifetime];
  const now = new Date();
  const link: MemoryLink = {
    token: randomBytes(16).toString('base64url'),
    circleId: input.circleId,
    personId: input.personId,
    createdBy: input.createdBy,
    createdAt: now.toISOString(),
    expiresAt: days === null ? null : new Date(now.getTime() + days * DAY_MS).toISOString(),
    uses: 0,
  };
  await putJson(linkKey(link.token), link);
  return link;
}

/** This person's links in this circle, newest first. */
export async function listLinks(circleId: string, personId: string): Promise<MemoryLink[]> {
  const all = await Promise.all(
    (await listObjects('memory-links/')).map((k) => getJson<MemoryLink>(k)),
  );
  return all
    .filter((l): l is MemoryLink => !!l && l.circleId === circleId && l.personId === personId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function revokeLink(token: string, circleId: string): Promise<boolean> {
  const link = await readLink(token);
  if (link?.circleId !== circleId) return false;
  await putJson(linkKey(token), { ...link, revokedAt: new Date().toISOString() });
  return true;
}

/** The link page: who it remembers and what's been let in. Nothing else of the circle. */
export async function previewLink(token: string): Promise<MemoryLinkPreview | null> {
  const link = await readLink(token);
  if (!link) return null;
  const state = stateOf(link);
  if (state !== 'open') return { state };
  const circle = await findCircle(link.circleId);
  if (!circle) return { state: 'revoked' };
  return inCircle(scopeOf(circle), async () => {
    const p = await remembered(link.personId);
    if (!p) return { state: 'revoked' as const };
    const born = p.born?.date?.slice(0, 4);
    const died = p.memorial?.died?.slice(0, 4);
    const shown = (await readVisitors(p.id)).memories.filter((m) => m.status === 'shown');
    return {
      state,
      person: {
        name: p.name,
        ...(died ? { years: born ? `${born} to ${died}` : died } : {}),
        ...(p.memorial?.dedication ? { dedication: p.memorial.dedication } : {}),
      },
      circle: { name: circle.name, kind: circle.kind },
      memories: shown.map(({ name, how, text, at }) => ({ name, how, text, at })),
    };
  });
}

export type AddResult = { ok: true } | { ok: false; status: 400 | 404 | 410 | 429; error: string };

/** Add a memory through a link. It waits for an admin. */
export async function addMemory(
  token: string,
  input: { name: string; how?: string; text: string },
): Promise<AddResult> {
  const link = await readLink(token);
  if (!link) return { ok: false, status: 404, error: 'Link not found' };
  if (stateOf(link) !== 'open') return { ok: false, status: 410, error: 'This link has closed' };
  const name = input.name.trim().slice(0, 60);
  const text = input.text.trim().slice(0, MEMORY_MAX);
  if (!name || !text) return { ok: false, status: 400, error: 'A name and a memory are needed' };
  const circle = await findCircle(link.circleId);
  if (!circle) return { ok: false, status: 410, error: 'This link has closed' };
  return inCircle(scopeOf(circle), async () => {
    if (!(await remembered(link.personId)))
      return { ok: false as const, status: 410 as const, error: 'This link has closed' };
    const v = await readVisitors(link.personId);
    if (v.memories.filter((m) => m.status === 'waiting').length >= WAITING_MAX)
      return {
        ok: false as const,
        status: 429 as const,
        error: 'Lots of memories are waiting. Try again soon.',
      };
    const how = input.how?.trim().slice(0, 120);
    v.memories.push({
      id: randomBytes(6).toString('base64url'),
      name,
      ...(how ? { how } : {}),
      text,
      at: new Date().toISOString(),
      status: 'waiting',
    });
    await putJson(visitorsKey(link.personId), v);
    await putJson(linkKey(token), { ...link, uses: link.uses + 1 });
    return { ok: true as const };
  });
}

/** Memories from outside the circle: the ones let in, and (for admins) the ones waiting. */
export async function visitorMemories(personId: string, withWaiting: boolean) {
  const { memories } = await readVisitors(personId);
  return withWaiting ? memories : memories.filter((m) => m.status === 'shown');
}

/** Let a memory in, or let it go. */
export async function decideMemory(personId: string, id: string, approve: boolean) {
  const v = await readVisitors(personId);
  const m = v.memories.find((x) => x.id === id);
  if (!m) return false;
  v.memories = approve
    ? v.memories.map((x) => (x.id === id ? { ...x, status: 'shown' as const } : x))
    : v.memories.filter((x) => x.id !== id);
  await putJson(visitorsKey(personId), v);
  return true;
}
