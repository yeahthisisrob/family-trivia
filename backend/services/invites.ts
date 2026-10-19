/**
 * Invite links (docs/decisions/0020). An invite lives outside any circle
 * (invites/{token}.json), because opening a link comes before signing in; a
 * join waiting for an admin lives in its circle (joins/{id}.json).
 */
import { randomBytes } from 'node:crypto';
import {
  type Circle,
  INVITE_LIFETIMES,
  type Invite,
  type InviteFor,
  type InviteLifetime,
  type InvitePreview,
  inviteState,
  type JoinDetails,
  type PendingJoin,
} from '@family-trivia/shared';
import { accountIdOf, findCircle, linkMember, listCircles, memberIn, scopeOf } from './circles';
import { addMember, idFor, loadUsers, nextColor } from './family/members';
import { loadFamily } from './family/roster';
import { logger } from './logger';
import { deleteObject, getJson, listObjects, putJson } from './s3';
import { inCircle } from './scope';

const TOKEN = /^[A-Za-z0-9_-]{22}$/;
const inviteKey = (token: string) => `invites/${token}.json`;
const joinKey = (id: string) => `joins/${id}.json`;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function readInvite(token: string): Promise<Invite | null> {
  return TOKEN.test(token) ? getJson<Invite>(inviteKey(token)) : null;
}

export async function createInvite(input: {
  circleId: string;
  for: InviteFor;
  lifetime: InviteLifetime;
  maxUses: number | null;
  approval: boolean;
  createdBy: string;
}): Promise<Invite> {
  const days = INVITE_LIFETIMES[input.lifetime];
  const now = new Date();
  const invite: Invite = {
    token: randomBytes(16).toString('base64url'),
    circleIds: [input.circleId],
    for: input.for,
    createdBy: input.createdBy,
    createdAt: now.toISOString(),
    expiresAt: days === null ? null : new Date(now.getTime() + days * DAY_MS).toISOString(),
    // A link for one person is used once, by them.
    maxUses: input.for.kind === 'person' ? 1 : input.maxUses,
    uses: 0,
    approval: input.for.kind === 'person' ? false : input.approval,
  };
  await putJson(inviteKey(invite.token), invite);
  return invite;
}

/** A circle's links, newest first: the open ones and any that ended in the last month. */
export async function listInvites(circleId: string): Promise<Invite[]> {
  const keys = await listObjects('invites/');
  const all = await Promise.all(keys.map((k) => getJson<Invite>(k)));
  const recent = Date.now() - 30 * DAY_MS;
  return all
    .filter((i): i is Invite => !!i && i.circleIds.includes(circleId))
    .filter((i) => inviteState(i) === 'open' || new Date(i.createdAt).getTime() > recent)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function revokeInvite(token: string, circleId: string): Promise<boolean> {
  const invite = await readInvite(token);
  if (!invite?.circleIds.includes(circleId)) return false;
  await putJson(inviteKey(token), { ...invite, revokedAt: new Date().toISOString() });
  return true;
}

/** What the link page shows before sign-in: its own circle's name, nothing else. */
export async function previewInvite(token: string): Promise<InvitePreview | null> {
  const invite = await readInvite(token);
  if (!invite) return null;
  const state = inviteState(invite);
  if (state !== 'open') return { state };
  const circle = await findCircle(invite.circleIds[0] ?? '');
  if (!circle) return { state: 'revoked' };
  const forName =
    invite.for.kind === 'person'
      ? await inCircle(scopeOf(circle), personName(invite.for.userId))
      : undefined;
  return {
    state,
    circle: { name: circle.name, kind: circle.kind },
    approval: invite.approval,
    ...(forName ? { forName } : {}),
  };
}

const personName = (userId: string) => async () =>
  (await loadFamily()).people[userId]?.name ?? userId;

export type AcceptResult =
  | { ok: true; circle: Circle; userId: string; joined: boolean }
  | { ok: true; pending: true; circle: Circle }
  | { ok: false; status: 400 | 404 | 409 | 410; error: string; errorType: string };

const gone = (state: string): AcceptResult => ({
  ok: false,
  status: 410,
  error:
    state === 'expired'
      ? 'This invite has expired. Ask for a new one.'
      : state === 'used-up'
        ? 'This invite has been used. Ask for a new one.'
        : 'This invite was taken back. Ask for a new one.',
  errorType: `INVITE_${state.toUpperCase().replace('-', '_')}`,
});

/**
 * Join through a link. Someone already in the circle just opens it. A link
 * for one person links them; a link for anyone adds them as someone new,
 * now or once an admin says yes.
 */
export async function acceptInvite(
  token: string,
  email: string,
  details: JoinDetails | null,
): Promise<AcceptResult> {
  const invite = await readInvite(token);
  if (!invite)
    return { ok: false, status: 404, error: 'Invite not found', errorType: 'INVITE_NOT_FOUND' };
  const state = inviteState(invite);
  if (state !== 'open') return gone(state);
  const circle = await findCircle(invite.circleIds[0] ?? '');
  if (!circle) return gone('revoked');

  const already = await memberIn(circle, email);
  if (already) return { ok: true, circle, userId: already, joined: false };

  let userId: string;
  if (invite.for.kind === 'person') {
    const linked = await linkMember(circle, invite.for.userId, email);
    if (!linked.ok)
      return { ok: false, status: 409, error: linked.error, errorType: linked.errorType };
    userId = invite.for.userId;
  } else {
    const name = details?.name?.trim();
    if (!name)
      return { ok: false, status: 400, error: 'Tell us your name', errorType: 'NAME_REQUIRED' };
    const clean: JoinDetails = {
      name: name.slice(0, 60),
      ...(details?.howWeMet?.trim() ? { howWeMet: details.howWeMet.trim().slice(0, 200) } : {}),
    };
    if (invite.approval) {
      await inCircle(scopeOf(circle), () => askToJoin(token, email, clean));
      await countUse(invite);
      return { ok: true, pending: true, circle };
    }
    userId = await inCircle(scopeOf(circle), () => admit(circle, email, clean));
  }
  await countUse(invite);
  logger.info('Joined through an invite', { circleId: circle.id });
  return { ok: true, circle, userId, joined: true };
}

async function countUse(invite: Invite) {
  const fresh = (await readInvite(invite.token)) ?? invite;
  await putJson(inviteKey(invite.token), { ...fresh, uses: fresh.uses + 1 });
}

/** Add someone new to the circle and link their sign-in. Runs in the circle. */
async function admit(circle: Circle, email: string, d: JoinDetails): Promise<string> {
  const users = await loadUsers();
  const family = await loadFamily();
  const id = idFor(d.name, (x) => x in users.users || x in family.people);
  const added = await addMember({
    id,
    name: d.name,
    color: nextColor(users.users),
    howWeMet: d.howWeMet,
  });
  if (!added.ok) throw new Error(added.error);
  const linked = await linkMember(circle, id, email);
  if (!linked.ok) throw new Error(linked.error);
  return id;
}

// ── Joins waiting for an admin ──────────────────────────────────

async function askToJoin(token: string, email: string, details: JoinDetails) {
  // One waiting request per person per circle: asking again updates it.
  const id = accountIdOf(email).slice(0, 16);
  const join: PendingJoin = { id, token, email, details, requestedAt: new Date().toISOString() };
  await putJson(joinKey(id), join);
}

/** The joins waiting in the current circle, oldest first. */
export async function listJoins(): Promise<PendingJoin[]> {
  const keys = await listObjects('joins/');
  const joins = await Promise.all(keys.map((k) => getJson<PendingJoin>(k)));
  return joins
    .filter((j): j is PendingJoin => !!j)
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
}

/** Say yes (they're added and can sign in) or no (the request is removed). Runs in the circle. */
export async function decideJoin(
  circleId: string,
  id: string,
  approve: boolean,
): Promise<{ ok: boolean; userId?: string }> {
  const join = await getJson<PendingJoin>(joinKey(id));
  const circle = (await listCircles()).find((c) => c.id === circleId);
  if (!join || !circle) return { ok: false };
  const userId = approve
    ? ((await memberIn(circle, join.email)) ?? (await admit(circle, join.email, join.details)))
    : undefined;
  await deleteObject(joinKey(id));
  return { ok: true, ...(userId ? { userId } : {}) };
}
