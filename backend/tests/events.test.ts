/**
 * Events (docs/decisions/0036) through the routes, as a client with a
 * person's own token: made in one circle, shared into another, seen only
 * by the people they're for, answered, talked about, changed and downloaded.
 */
vi.hoisted(() => {
  process.env.JWT_SECRET = 'x'.repeat(40); // test-only signing key
});
vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import { addDays, getTodayET } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { commentsRoutes } from '../features/comments/routes';
import { plansRoutes } from '../features/plans/routes';
import { signJwt } from '../services/auth';
import { getStored, resetS3Mock, seedRaw } from './helpers/s3Mock';

const today = getTodayET();
const day = (n: number) => addDays(today, n);
const routes: Record<string, (e: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>> = {
  ...plansRoutes,
  ...commentsRoutes,
};

const family = (ids: string[]) => ({
  version: 2,
  name: 'x',
  people: Object.fromEntries(
    ids.map((id) => [
      id,
      { id, name: id[0]?.toUpperCase() + id.slice(1), participation: 'playing' },
    ]),
  ),
  ties: [],
  households: {},
});

/** A family (alice, bob, eve the admin) and a crew (alice is "al" there, carol, dee). */
beforeEach(() => {
  resetS3Mock();
  seedRaw('circles.json', {
    version: 1,
    circles: [
      { id: 'home', name: 'The Smiths', kind: 'family', root: true },
      { id: 'crew', name: 'The Crew', kind: 'friends' },
    ],
  });
  seedRaw('config/users.json', { users: { alice: {}, bob: {}, eve: { isAdmin: true } } });
  seedRaw('config/google-auth-map.json', {
    'alice@example.com': 'alice',
    'bob@example.com': 'bob',
    'eve@example.com': 'eve',
  });
  seedRaw('family/family.json', family(['alice', 'bob', 'eve']));
  seedRaw('circles/crew/config/users.json', { users: { al: {}, carol: {}, dee: {} } });
  seedRaw('circles/crew/config/google-auth-map.json', {
    'alice@example.com': 'al',
    'carol@example.com': 'carol',
    'dee@example.com': 'dee',
  });
  seedRaw('circles/crew/family/family.json', family(['al', 'carol', 'dee']));
});

async function call(
  who: string,
  circle: 'home' | 'crew',
  route: string,
  { query, body }: { query?: Record<string, string>; body?: unknown } = {},
) {
  const token = await signJwt({ sub: who, email: `${who}@example.com` });
  const r = await routes[route]?.({
    headers: { Authorization: `Bearer ${token}`, 'x-circle': circle },
    queryStringParameters: query ?? null,
    body: body === undefined ? null : JSON.stringify(body),
  } as unknown as APIGatewayProxyEvent);
  if (!r) throw new Error(`no route ${route}`);
  const json = r.headers?.['Content-Type']?.toString().includes('json');
  return { status: r.statusCode, data: json ? JSON.parse(r.body).data : r.body };
}

const gymnastics = {
  title: 'Gymnastics',
  start: day(1),
  time: { start: '17:30', end: '18:30' },
  place: 'Springfield Gym',
  details: 'Anyone can come and watch',
  weekly: { days: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] },
};

test('made in a circle with no audience: the whole circle sees it in the weeks ahead', async () => {
  const made = await call('alice', 'home', 'POST /plans/events', { body: gymnastics });
  expect(made.status).toBe(201);
  expect(made.data.event).toMatchObject({ by: 'alice', kind: 'plan', zone: 'America/New_York' });
  const bob = await call('bob', 'home', 'GET /plans');
  expect(bob.data.drops.map((d: { title: string }) => d.title)).toEqual(['Gymnastics']);
  expect(bob.data.days[1].plans).toEqual([made.data.event.id]);
  // Nothing crosses into the crew without an audience that names it.
  expect((await call('carol', 'crew', 'GET /plans')).data.drops).toEqual([]);
});

test('shared into another circle for chosen people: only they see, answer and comment', async () => {
  const made = await call('alice', 'home', 'POST /plans/events', {
    body: {
      ...gymnastics,
      audience: [{ circleId: 'home' }, { circleId: 'crew', people: ['carol'] }],
    },
  });
  const id = made.data.event.id as string;
  expect(getStored('circles/crew/plans/shared-in.json')).toEqual({
    events: [{ from: 'home', by: 'alice', here: 'al', id }],
  });

  const carol = await call('carol', 'crew', 'GET /plans');
  expect(carol.data.drops[0]).toMatchObject({
    id,
    by: 'al',
    from: { circleId: 'home', name: 'The Smiths' },
    audience: [{ circleId: 'crew', people: ['carol'] }],
  });
  expect((await call('dee', 'crew', 'GET /plans')).data.drops).toEqual([]);

  // Answers and comments stay in the circle they were made in.
  const rsvp = { id, answer: 'in', guests: 2, note: 'Bringing the kids' };
  expect((await call('carol', 'crew', 'POST /plans/rsvp', { body: rsvp })).status).toBe(200);
  expect((await call('dee', 'crew', 'POST /plans/rsvp', { body: rsvp })).status).toBe(404);
  expect(getStored(`circles/crew/plans/rsvp/${id}.json`)).toEqual({
    carol: { answer: 'in', note: 'Bringing the kids', guests: 2, at: expect.any(String) },
  });
  const comment = { contentType: 'event', contentId: id, text: 'See you there' };
  expect((await call('carol', 'crew', 'POST /comments', { body: comment })).status).toBe(201);
  expect((await call('dee', 'crew', 'POST /comments', { body: comment })).status).toBe(404);
  expect(
    (await call('dee', 'crew', 'GET /comments', { query: { contentType: 'event', contentId: id } }))
      .status,
  ).toBe(404);

  // The family sees its own answers by name and the crew's as counts.
  await call('bob', 'home', 'POST /plans/rsvp', { body: { id, answer: 'maybe' } });
  const seen = await call('alice', 'home', 'GET /plans/events', { query: { id } });
  expect(seen.data.event).toMatchObject({
    invited: ['alice', 'bob', 'eve'],
    rsvps: { bob: { answer: 'maybe' } },
    elsewhere: [{ name: 'The Crew', in: 1, maybe: 0, out: 0, guests: 2 }],
    canEdit: true,
  });
  const bobSees = await call('bob', 'home', 'GET /plans/events', { query: { id } });
  expect(bobSees.data.event.event.audience).toEqual([{ circleId: 'home' }]);
  expect(bobSees.data.event.elsewhere[0].name).toBe('Another circle');
  expect(bobSees.data.event.canEdit).toBe(false);
});

test('a circle the creator is not in, or someone not in it, is turned away', async () => {
  const notMine = await call('bob', 'home', 'POST /plans/events', {
    body: { ...gymnastics, audience: [{ circleId: 'crew' }] },
  });
  expect(notMine.status).toBe(403);
  const stranger = await call('alice', 'home', 'POST /plans/events', {
    body: { ...gymnastics, audience: [{ circleId: 'crew', people: ['zed'] }] },
  });
  expect(stranger).toMatchObject({ status: 400 });
  expect(
    (await call('alice', 'home', 'POST /plans/events', { body: { start: day(1) } })).status,
  ).toBe(400);
});

test('its creator or an admin changes it; an admin keeps who it is for; cancelling stops answers', async () => {
  const made = await call('alice', 'home', 'POST /plans/events', {
    body: { ...gymnastics, audience: [{ circleId: 'home' }, { circleId: 'crew' }] },
  });
  const id = made.data.event.id as string;
  expect(
    (await call('bob', 'home', 'PUT /plans/events', { body: { ...gymnastics, id } })).status,
  ).toBe(403);

  const byAdmin = await call('eve', 'home', 'PUT /plans/events', {
    body: { ...gymnastics, id, title: 'Gymnastics meet', audience: [{ circleId: 'home' }] },
  });
  expect(byAdmin.data.event).toMatchObject({ title: 'Gymnastics meet', by: 'alice' });
  expect(getStored('circles/crew/plans/shared-in.json')).toMatchObject({ events: [{ id }] });

  // The creator, from the crew, skips one day and takes the crew off it.
  const fromCrew = await call('alice', 'crew', 'PUT /plans/events', {
    body: { ...gymnastics, id, skip: [day(2)], audience: [{ circleId: 'home' }] },
  });
  expect(fromCrew.status).toBe(200);
  expect(getStored('circles/crew/plans/shared-in.json')).toEqual({ events: [] });
  const week = await call('bob', 'home', 'GET /plans');
  expect(week.data.days[2].plans).toEqual([]);
  expect(week.data.days[3].plans).toEqual([id]);

  await call('alice', 'home', 'PUT /plans/events', {
    body: { ...gymnastics, id, cancelled: true },
  });
  const late = await call('bob', 'home', 'POST /plans/rsvp', { body: { id, answer: 'in' } });
  expect(late.status).toBe(409);
});

test('turned off, the server refuses events and the weeks ahead show none', async () => {
  const made = await call('alice', 'home', 'POST /plans/events', { body: gymnastics });
  seedRaw('config/settings.json', { 'features.events': false });
  expect((await call('alice', 'home', 'POST /plans/events', { body: gymnastics })).status).toBe(
    403,
  );
  const id = made.data.event.id as string;
  expect((await call('bob', 'home', 'GET /plans/events', { query: { id } })).status).toBe(403);
  expect((await call('bob', 'home', 'GET /plans')).data.drops).toEqual([]);
});

test('the calendar file, for the people it is for', async () => {
  const made = await call('alice', 'home', 'POST /plans/events', {
    body: { ...gymnastics, audience: [{ circleId: 'home', people: ['bob'] }] },
  });
  const id = made.data.event.id as string;
  const ics = await call('bob', 'home', 'GET /plans/events/ics', { query: { id } });
  expect(ics.status).toBe(200);
  expect(ics.data).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU');
  expect((await call('eve', 'home', 'GET /plans/events/ics', { query: { id } })).status).toBe(404);
});

test('the circles and people the caller can invite, this circle first', async () => {
  const r = await call('alice', 'crew', 'GET /plans/events/audience');
  expect(r.data.circles.map((c: { circleId: string; me: string }) => [c.circleId, c.me])).toEqual([
    ['crew', 'al'],
    ['home', 'alice'],
  ]);
  expect(r.data.circles[1].people.map((p: { name: string }) => p.name)).toEqual([
    'Alice',
    'Bob',
    'Eve',
  ]);
});

test('taking an event back takes it out of every circle it was shared into', async () => {
  const made = await call('alice', 'home', 'POST /plans/events', {
    body: { ...gymnastics, audience: [{ circleId: 'home' }, { circleId: 'crew' }] },
  });
  await call('alice', 'home', 'POST /plans/remove', { body: { id: made.data.event.id } });
  expect(getStored('circles/crew/plans/shared-in.json')).toEqual({ events: [] });
});

test('answers saved as "in" or "out" move to the new shape, in every circle, only with apply', async () => {
  const { migrateRsvps } = await import('../features/plans/migrateRsvps');
  seedRaw('plans/rsvp/bob-hike.json', { alice: 'in', eve: { answer: 'maybe', at: 'y' } });
  seedRaw('circles/crew/plans/rsvp/dee-1.json', { carol: 'out' });
  expect(await migrateRsvps(false, 'now')).toEqual([
    { circleId: 'home', files: 1, changed: 1 },
    { circleId: 'crew', files: 1, changed: 1 },
  ]);
  expect(getStored('plans/rsvp/bob-hike.json')).toMatchObject({ alice: 'in' });
  await migrateRsvps(true, 'now');
  expect(getStored('plans/rsvp/bob-hike.json')).toEqual({
    alice: { answer: 'in', at: 'now' },
    eve: { answer: 'maybe', at: 'y' },
  });
  expect(getStored('circles/crew/plans/rsvp/dee-1.json')).toEqual({
    carol: { answer: 'out', at: 'now' },
  });
});
