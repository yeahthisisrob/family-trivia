vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getCircles, postCircle } from '../features/circles/handlers';
import { postInvite } from '../features/invites/handlers';
import type { Caller } from '../middleware/requireAuth';
import { appInit, appInitDeferred } from '../routes/appInit';
import { createCircle, findCircle, scopeOf } from '../services/circles';
import { activatedIds } from '../services/family/joined';
import { loadFamily, loadHierarchy } from '../services/family/roster';
import {
  acceptInvite,
  createInvite,
  decideJoin,
  listInvites,
  listJoins,
  previewInvite,
  revokeInvite,
} from '../services/invites';
import { inCircle } from '../services/scope';
import { getStored, listStored, resetS3Mock, seedRaw } from './helpers/s3Mock';

const home = { id: 'home', name: 'The Smiths', kind: 'family' as const, root: true };

/** The Smiths at the root, with alice (an admin) signed in. */
function seedFamily() {
  seedRaw('config/users.json', { users: { alice: { group: '', color: '#000', isAdmin: true } } });
  seedRaw('config/google-auth-map.json', { 'alice@example.com': 'alice' });
}

async function makeCrew() {
  seedFamily();
  return createCircle(
    { name: 'The Crew', kind: 'friends', themeId: 'ocean' },
    {
      email: 'alice@example.com',
      name: 'Alice',
    },
  );
}

const anyone = (circleId: string, over: Partial<Parameters<typeof createInvite>[0]> = {}) =>
  createInvite({
    circleId,
    for: { kind: 'anyone' },
    lifetime: 'week',
    maxUses: null,
    approval: false,
    createdBy: 'alice',
    ...over,
  });

beforeEach(() => resetS3Mock());

describe('starting a circle', () => {
  test('the maker is its first admin, already signed in, and the family circle is kept first', async () => {
    const crew = await makeCrew();
    expect(crew).toMatchObject({ id: 'the-crew', kind: 'friends' });
    expect(
      getStored<{ circles: { id: string }[] }>('circles.json')?.circles.map((c) => c.id),
    ).toEqual(['home', 'the-crew']);
    expect(getStored('circles/the-crew/config/users.json')).toMatchObject({
      users: { alice: { isAdmin: true } },
    });
    expect(getStored('circles/the-crew/config/google-auth-map.json')).toEqual({
      'alice@example.com': 'alice',
    });
    expect(getStored('circles/the-crew/config/appearance.json')).toEqual({ themeId: 'ocean' });
  });

  test("a new circle's people are in its family file and read the same in the older screens", async () => {
    const crew = await makeCrew();
    await inCircle(scopeOf(crew), async () => {
      expect((await loadFamily()).people.alice?.name).toBe('Alice');
      const h = await loadHierarchy<{ family: { people: Record<string, { name: string }> } }>();
      expect(h?.family.people.alice?.name).toBe('Alice');
    });
  });

  test('a new circle opens: app-init works with only what starting it wrote', async () => {
    const crew = await makeCrew();
    const event = { queryStringParameters: { userId: 'alice' } } as unknown as APIGatewayProxyEvent;
    const [init, deferred] = await inCircle(scopeOf(crew), () =>
      Promise.all([appInit(event), appInitDeferred(event)]),
    );
    expect(init.statusCode).toBe(200);
    expect(deferred.statusCode).toBe(200);
    expect(JSON.stringify(JSON.parse(init.body))).toContain('Alice');

    // What the app needs to finish loading and let people play.
    const { data } = JSON.parse(init.body);
    expect(data.hierarchy.hierarchy.version).toBeTruthy();
    expect(Object.keys(data.hierarchy.hierarchy.family.people)).toEqual(['alice']);
    expect(data.seasonStatus.isEndOfSeason).toBe(false);
    expect(data.categories.length).toBeGreaterThan(3);
    // The circle's own category, named for friends.
    expect(data.categories[0].name).toBe('Our Crew');
    // Nobody has played yet, so nobody is hidden from the circle.
    expect(await inCircle(scopeOf(crew), () => activatedIds())).toBeNull();
  });

  test('only the owner starts circles', async () => {
    seedFamily();
    seedRaw('config/users.json', {
      users: { alice: { isAdmin: true }, bob: { group: '', color: '#111' } },
    });
    seedRaw('config/google-auth-map.json', {
      'alice@example.com': 'alice',
      'bob@example.com': 'bob',
    });
    const as = (email: string): Caller => ({ email, circle: home });
    const body = {
      body: JSON.stringify({ name: 'X', kind: 'friends', yourName: 'Bob' }),
    } as APIGatewayProxyEvent;
    expect((await postCircle(body, 'bob', as('bob@example.com'))).statusCode).toBe(403);
    expect(JSON.parse((await getCircles(body, 'bob', as('bob@example.com'))).body).data).toEqual({
      owner: false,
      circles: [],
    });
    const made = await postCircle(body, 'alice', as('alice@example.com'));
    expect(made.statusCode).toBe(200);
    // The answer lists the new circle, so the app can open it straight away.
    const { circle, circles } = JSON.parse(made.body).data;
    expect(circles.map((c: { id: string }) => c.id)).toContain(circle.id);
  });

  test('an owner invites to a circle from Admin › Circles without opening it', async () => {
    const crew = await makeCrew();
    const as = { email: 'alice@example.com', circle: home } as Caller;
    const r = await postInvite(
      { body: JSON.stringify({ circleId: crew.id, lifetime: 'week' }) } as APIGatewayProxyEvent,
      'alice',
      as,
    );
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body).data.invite.circleIds).toEqual([crew.id]);
    // Someone who isn't an admin there can't.
    const bob = { email: 'bob@example.com', circle: home } as Caller;
    const no = await postInvite(
      { body: JSON.stringify({ circleId: crew.id }) } as APIGatewayProxyEvent,
      'bob',
      bob,
    );
    expect(no.statusCode).toBe(403);
  });
});

describe('invite links', () => {
  test('a link for anyone adds them as someone new, signed in, and counts the use', async () => {
    const crew = await makeCrew();
    const invite = await anyone(crew.id);
    const r = await acceptInvite(invite.token, 'dee@example.com', {
      name: 'Dee',
      howWeMet: 'college',
    });
    expect(r).toMatchObject({ ok: true, userId: 'dee', joined: true });
    expect(getStored('circles/the-crew/config/google-auth-map.json')).toMatchObject({
      'dee@example.com': 'dee',
    });
    await inCircle(scopeOf(crew), async () => {
      expect((await loadFamily()).people.dee).toMatchObject({ name: 'Dee', howWeMet: 'college' });
    });
    expect(getStored<{ uses: number }>(`invites/${invite.token}.json`)?.uses).toBe(1);
  });

  test('two people with the same name get different ids', async () => {
    const crew = await makeCrew();
    const invite = await anyone(crew.id);
    await acceptInvite(invite.token, 'a@example.com', { name: 'Sam' });
    const r = await acceptInvite(invite.token, 'b@example.com', { name: 'Sam' });
    expect(r).toMatchObject({ ok: true, userId: 'sam-2' });
  });

  test('a link for one person links them, once', async () => {
    const crew = await makeCrew();
    await inCircle(scopeOf(crew), async () => {
      seedRaw('circles/the-crew/config/users.json', {
        users: { alice: { isAdmin: true }, sam: { group: '', color: '#222' } },
      });
    });
    const invite = await createInvite({
      circleId: crew.id,
      for: { kind: 'person', userId: 'sam' },
      lifetime: 'month',
      maxUses: 5,
      approval: true,
      createdBy: 'alice',
    });
    expect(invite).toMatchObject({ maxUses: 1, approval: false });
    expect(await acceptInvite(invite.token, 'j@example.com', null)).toMatchObject({
      ok: true,
      userId: 'sam',
    });
    expect(await acceptInvite(invite.token, 'other@example.com', null)).toMatchObject({
      ok: false,
      errorType: 'INVITE_USED_UP',
    });
  });

  test('someone already in the circle just opens it; no new person, no use counted', async () => {
    const crew = await makeCrew();
    const invite = await anyone(crew.id, { maxUses: 1 });
    expect(
      await acceptInvite(invite.token, 'alice@example.com', { name: 'Alice again' }),
    ).toMatchObject({
      ok: true,
      userId: 'alice',
      joined: false,
    });
    expect(getStored<{ uses: number }>(`invites/${invite.token}.json`)?.uses).toBe(0);
  });

  test('expired, used up and taken back links each say so', async () => {
    const crew = await makeCrew();
    const once = await anyone(crew.id, { maxUses: 1 });
    await acceptInvite(once.token, 'x@example.com', { name: 'X' });
    expect(await acceptInvite(once.token, 'y@example.com', { name: 'Y' })).toMatchObject({
      errorType: 'INVITE_USED_UP',
    });

    const old = await anyone(crew.id);
    seedRaw(`invites/${old.token}.json`, { ...old, expiresAt: '2020-01-01T00:00:00.000Z' });
    expect(await acceptInvite(old.token, 'y@example.com', { name: 'Y' })).toMatchObject({
      errorType: 'INVITE_EXPIRED',
    });

    const back = await anyone(crew.id);
    expect(await revokeInvite(back.token, 'home')).toBe(false); // another circle can't
    expect(await revokeInvite(back.token, crew.id)).toBe(true);
    expect(await previewInvite(back.token)).toEqual({ state: 'revoked' });
  });

  test('the link page shows only its own circle', async () => {
    const crew = await makeCrew();
    const invite = await anyone(crew.id);
    expect(await previewInvite(invite.token)).toEqual({
      state: 'open',
      circle: { name: 'The Crew', kind: 'friends' },
      approval: false,
    });
    expect(await previewInvite('not-a-real-token')).toBeNull();
  });

  test("a circle's admins see only its own links", async () => {
    const crew = await makeCrew();
    await anyone(crew.id);
    await anyone('home');
    expect(await inCircle(scopeOf(crew), () => listInvites(crew.id))).toHaveLength(1);
  });
});

describe('joins that wait for a yes', () => {
  test('the person waits; a yes adds them, a no removes the request', async () => {
    const crew = await makeCrew();
    const invite = await anyone(crew.id, { approval: true });
    expect(await acceptInvite(invite.token, 'eve@example.com', { name: 'Eve' })).toMatchObject({
      ok: true,
      pending: true,
    });
    expect(await acceptInvite(invite.token, 'fay@example.com', { name: 'Fay' })).toMatchObject({
      pending: true,
    });

    const scope = scopeOf((await findCircle(crew.id))!);
    const joins = await inCircle(scope, () => listJoins());
    expect(joins.map((j) => j.details.name)).toEqual(['Eve', 'Fay']);
    expect(listStored('circles/the-crew/joins/')).toHaveLength(2);
    expect(listStored('circles/the-crew/joins/').join()).not.toMatch(/eve|fay/); // no email in keys

    const [eve, fay] = joins;
    expect(await inCircle(scope, () => decideJoin(crew.id, eve!.id, true))).toEqual({
      ok: true,
      userId: 'eve',
    });
    await inCircle(scope, () => decideJoin(crew.id, fay!.id, false));
    expect(await inCircle(scope, () => listJoins())).toEqual([]);
    expect(getStored('circles/the-crew/config/google-auth-map.json')).toMatchObject({
      'eve@example.com': 'eve',
    });
    expect(getStored('circles/the-crew/config/google-auth-map.json')).not.toHaveProperty(
      'fay@example.com',
    );
  });
});
