vi.hoisted(() => {
  process.env.JWT_SECRET = 'x'.repeat(40); // test-only signing key
});
vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);
vi.mock('../services/auth', async (original) => ({
  ...(await original<typeof import('../services/auth')>()),
  verifyGoogleToken: async (t: string) =>
    t.startsWith('google:') ? { email: t.slice(7), name: 'X' } : null,
}));

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { signIn } from '../features/circles/handlers';
import { requireAuth } from '../middleware/requireAuth';
import { signJwt } from '../services/auth';
import { linkByPassphrase, myCircles, resolveCircle } from '../services/circles';
import { getJson, listObjects, putJson } from '../services/s3';
import {
  circleCache,
  currentScope,
  inCircle,
  logicalKey,
  physicalKey,
  type Scope,
  setFallbackScope,
} from '../services/scope';
import { getStored, resetS3Mock, seedRaw } from './helpers/s3Mock';

const crew: Scope = { circleId: 'crew', root: false };
const home: Scope = { circleId: 'home', root: true };

/** A family at the root (from before circles) and a friends circle. */
function seedTwoCircles() {
  seedRaw('circles.json', {
    version: 1,
    circles: [
      { id: 'home', name: 'The Smiths', kind: 'family', root: true },
      { id: 'crew', name: 'The Crew', kind: 'friends' },
    ],
  });
  seedRaw('config/users.json', { users: { alice: { passphrase: 'blue-heron' }, bob: {} } });
  seedRaw('config/google-auth-map.json', { 'bob@example.com': 'bob' });
  seedRaw('circles/crew/config/users.json', { users: { al: { passphrase: 'red-fox' }, dee: {} } });
  seedRaw('circles/crew/config/google-auth-map.json', { 'dee@example.com': 'dee' });
}

beforeEach(() => resetS3Mock());

describe('scope', () => {
  test('a circle keeps its keys under circles/{id}/; the root circle keeps them as they were', async () => {
    expect(await inCircle(crew, async () => physicalKey('config/users.json'))).toBe(
      'circles/crew/config/users.json',
    );
    expect(await inCircle(home, async () => physicalKey('config/users.json'))).toBe(
      'config/users.json',
    );
  });

  test('sign-in data is shared by every circle', async () => {
    expect(await inCircle(crew, async () => physicalKey('accounts/abc.json'))).toBe(
      'accounts/abc.json',
    );
  });

  test('work with no circle set fails instead of guessing', () => {
    setFallbackScope(null);
    try {
      expect(() => currentScope()).toThrow(/No circle/);
    } finally {
      setFallbackScope(home);
    }
  });

  test("one circle never reads, writes or lists another's data", async () => {
    await inCircle(crew, () => putJson('comments/a.json', { by: 'dee' }));
    await inCircle(home, () => putJson('comments/b.json', { by: 'bob' }));
    expect(await inCircle(home, () => getJson('comments/a.json'))).toBeNull();
    expect(await inCircle(crew, () => listObjects('comments/'))).toEqual(['comments/a.json']);
    expect(await inCircle(home, () => listObjects(''))).toEqual(['comments/b.json']);
    expect(getStored('circles/crew/comments/a.json')).toEqual({ by: 'dee' });
  });

  test('the root circle never lists other circles or sign-in data', async () => {
    expect(await inCircle(home, async () => logicalKey('circles/crew/x.json'))).toBeNull();
    expect(await inCircle(home, async () => logicalKey('accounts/x.json'))).toBeNull();
    expect(await inCircle(crew, async () => logicalKey('circles/crew/x.json'))).toBe('x.json');
  });

  test('caches keep one value per circle', async () => {
    const cache = circleCache<string>(60_000);
    await inCircle(crew, async () => cache.set('crew value'));
    expect(await inCircle(home, async () => cache.get())).toBeNull();
    expect(await inCircle(crew, async () => cache.get())).toBe('crew value');
  });
});

describe('membership', () => {
  test('one sign-in can be in many circles', async () => {
    seedTwoCircles();
    seedRaw('circles/crew/config/google-auth-map.json', {
      'dee@example.com': 'dee',
      'bob@example.com': 'bobby',
    });
    const mine = await myCircles('bob@example.com');
    expect(mine.map((c) => [c.id, c.userId])).toEqual([
      ['home', 'bob'],
      ['crew', 'bobby'],
    ]);
  });

  test('a request in a circle gets who the caller is there; outsiders are refused', async () => {
    seedTwoCircles();
    expect(await resolveCircle('dee@example.com', 'crew')).toMatchObject({
      ok: true,
      userId: 'dee',
    });
    expect(await resolveCircle('dee@example.com', 'home')).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(await resolveCircle('nobody@example.com')).toMatchObject({ ok: false, status: 403 });
  });

  test('someone removed from a circle loses it at once, whatever the index says', async () => {
    seedTwoCircles();
    await myCircles('dee@example.com'); // builds the index
    seedRaw('circles/crew/config/google-auth-map.json', {});
    expect(await resolveCircle('dee@example.com', 'crew')).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  test('someone added after they last signed in is found when they open that circle', async () => {
    seedTwoCircles();
    await myCircles('bob@example.com'); // index: home only
    seedRaw('circles/crew/config/google-auth-map.json', { 'bob@example.com': 'bobby' });
    expect(await resolveCircle('bob@example.com', 'crew')).toMatchObject({
      ok: true,
      userId: 'bobby',
    });
  });
});

describe('passphrases', () => {
  test('a passphrase links the person in whichever circle it belongs to', async () => {
    seedTwoCircles();
    const r = await linkByPassphrase('bob@example.com', ' Red-Fox ');
    expect(r).toMatchObject({ ok: true, userId: 'al' });
    expect(getStored('circles/crew/config/google-auth-map.json')).toMatchObject({
      'bob@example.com': 'al',
    });
  });

  test('a passphrase two circles share links nobody', async () => {
    seedTwoCircles();
    seedRaw('circles/crew/config/users.json', { users: { al: { passphrase: 'blue-heron' } } });
    expect(await linkByPassphrase('x@example.com', 'blue-heron')).toMatchObject({
      ok: false,
      errorType: 'PASSPHRASE_AMBIGUOUS',
    });
  });

  test('a person linked to one Google account cannot be taken by another', async () => {
    seedTwoCircles();
    seedRaw('config/google-auth-map.json', { 'alice@example.com': 'alice' });
    expect(await linkByPassphrase('mallory@example.com', 'blue-heron')).toMatchObject({
      ok: false,
      errorType: 'USER_ALREADY_LINKED',
    });
  });
});

describe('signing in and calling in a circle', () => {
  const post = (body: unknown) =>
    signIn({ body: JSON.stringify(body) } as APIGatewayProxyEvent).then((r) => ({
      status: r.statusCode,
      body: JSON.parse(r.body),
    }));

  test('a passphrase joins one more circle and opens it', async () => {
    seedTwoCircles();
    const r = await post({ googleIdToken: 'google:bob@example.com', passphrase: 'red-fox' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ circleId: 'crew', userId: 'al', isNewLink: true });
    expect(r.body.data.circles.map((c: { id: string }) => c.id)).toEqual(['home', 'crew']);
  });

  test('someone in no circle is asked for a passphrase', async () => {
    seedTwoCircles();
    const r = await post({ googleIdToken: 'google:new@example.com' });
    expect(r).toMatchObject({ status: 401, body: { errorType: 'NOT_LINKED' } });
  });

  test("a handler runs in the circle the request names, as the caller's person there", async () => {
    seedTwoCircles();
    seedRaw('circles/crew/config/google-auth-map.json', {
      'dee@example.com': 'dee',
      'bob@example.com': 'bobby',
    });
    const token = await signJwt({ sub: 'acct', email: 'bob@example.com' });
    const handler = requireAuth(async (_e, userId) => ({
      statusCode: 200,
      body: JSON.stringify({ userId, users: await getJson('config/users.json') }),
    }));
    const call = (circle?: string) =>
      handler({
        headers: { Authorization: `Bearer ${token}`, ...(circle ? { 'x-circle': circle } : {}) },
        queryStringParameters: null,
        body: null,
      } as unknown as APIGatewayProxyEvent);

    const inCrew = JSON.parse((await call('crew')).body);
    expect(inCrew.userId).toBe('bobby');
    expect(Object.keys(inCrew.users.users)).toEqual(['al', 'dee']);
    expect(JSON.parse((await call()).body).userId).toBe('bob');
  });

  test('a token from before circles keeps working in the family it was made for', async () => {
    seedRaw('config/google-auth-map.json', { 'bob@example.com': 'bob' });
    const token = await signJwt({ sub: 'bob', email: 'bob@example.com' });
    const handler = requireAuth(async (_e, userId) => ({ statusCode: 200, body: userId }));
    const r = await handler({
      headers: { Authorization: `Bearer ${token}` },
      queryStringParameters: null,
      body: null,
    } as unknown as APIGatewayProxyEvent);
    expect(r.body).toBe('bob');
  });
});

describe('joining while signed in', () => {
  test('a wrong passphrase is a bad answer, never a lost session', async () => {
    seedTwoCircles();
    const { joinCircle } = await import('../features/circles/handlers');
    const r = await joinCircle(
      { body: JSON.stringify({ passphrase: 'nope' }) } as APIGatewayProxyEvent,
      'bob',
      {
        email: 'bob@example.com',
        circle: { id: 'home', name: 'The Smiths', kind: 'family', root: true },
      },
    );
    expect(r.statusCode).toBe(422);
  });
});
