vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type {
  Circle,
  FactAnswerEntry,
  Family,
  FamilyPerson,
  SeasonsConfig,
} from '@family-trivia/shared';
import { getSame, getSharing, postSame, putSharing } from '../features/circles/handlers';
import {
  findCircle,
  joinCircles,
  memberIn,
  myCircles,
  resolveCircle,
  scopeOf,
  splitCircle,
} from '../services/circles';
import {
  appendFactAnswer,
  getAllFactHistories,
  getAnsweredDates,
  invalidateFactHistoryCache,
} from '../services/factHistoryService';
import { forgetJoined, updatePerson } from '../services/family/joinedCircles';
import { loadFamily, loadHierarchy } from '../services/family/roster';
import { getJson, putJson } from '../services/s3';
import { inCircle, PeopleLiveInSources, setFallbackScope } from '../services/scope';
import { getStored, resetS3Mock, seedRaw } from './helpers/s3Mock';

const person = (id: string): FamilyPerson => ({
  id,
  name: id[0]?.toUpperCase() + id.slice(1),
  participation: 'playing',
});
const family = (ids: string[], ties: Family['ties'] = []): Family => ({
  version: 2,
  name: 'x',
  people: Object.fromEntries(ids.map((id) => [id, person(id)])),
  ties,
  households: {},
});

/** The Smiths at the root (from before circles) and the Crew, with Alice in both. */
function seed() {
  resetS3Mock();
  forgetJoined();
  seedRaw('circles.json', {
    version: 1,
    circles: [
      { id: 'home', name: 'The Smiths', kind: 'family', root: true },
      { id: 'crew', name: 'The Crew', kind: 'friends' },
    ],
  });
  seedRaw(
    'family/family.json',
    family(
      ['alice', 'bob'],
      [{ id: 't1', type: 'partner', a: 'alice', b: 'bob', kind: 'married' }],
    ),
  );
  seedRaw('config/users.json', { users: { alice: { isAdmin: true }, bob: {} } });
  seedRaw('config/google-auth-map.json', {
    'alice@example.com': 'alice',
    'bob@example.com': 'bob',
  });
  seedRaw('config/member-activation.json', { bob: true });
  seedRaw('circles/crew/family/family.json', family(['al', 'dave']));
  seedRaw('circles/crew/config/users.json', { users: { al: { isAdmin: true }, dave: {} } });
  seedRaw('circles/crew/config/google-auth-map.json', {
    'alice@example.com': 'al',
    'dave@example.com': 'dave',
  });
}

async function joined(): Promise<Circle> {
  const r = await joinCircles({ name: 'Everyone', sources: ['home', 'crew'] }, 'alice@example.com');
  if (!r.ok) throw new Error(r.error);
  return r.circle;
}

const inside = <T>(c: Circle, f: () => Promise<T>) => inCircle(scopeOf(c), f);

describe('joining circles (0018)', () => {
  beforeEach(seed);

  it('reads everyone from both circles, with Alice as one person', async () => {
    const c = await joined();
    expect(c).toMatchObject({ kind: 'mixed', sources: ['home', 'crew'] });
    const fam = await inside(c, loadFamily);
    expect(Object.keys(fam.people).sort()).toEqual(['alice', 'bob', 'dave']);
    expect(fam.ties).toHaveLength(1);
    // The old tree reads it too, derived from the joined people.
    expect(await inside(c, loadHierarchy)).not.toBeNull();
    expect(await memberIn(c, 'dave@example.com')).toBe('dave');
    expect(await memberIn(c, 'alice@example.com')).toBe('alice');
  });

  it('copies nothing: the joined circle keeps only its own seasons', async () => {
    const c = await joined();
    expect(getStored(`circles/${c.id}/family/family.json`)).toBeUndefined();
    expect(getStored(`circles/${c.id}/config/users.json`)).toBeUndefined();
    const seasons = getStored<SeasonsConfig>(`circles/${c.id}/config/seasons.json`);
    expect(seasons?.currentSeasonNumber).toBe(1);
  });

  it('lets everyone in either circle open it', async () => {
    const c = await joined();
    expect((await myCircles('dave@example.com')).map((m) => m.id)).toContain(c.id);
    const r = await resolveCircle('bob@example.com', c.id);
    expect(r.ok && r.userId).toBe('bob');
  });

  it('shows someone a change in a source at once (after the short cache)', async () => {
    const c = await joined();
    await inside(c, loadFamily);
    seedRaw('circles/crew/family/family.json', family(['al', 'dave', 'erin']));
    forgetJoined(c.id);
    expect(Object.keys((await inside(c, loadFamily)).people)).toContain('erin');
  });

  it("refuses to write the joined circle's people: they live in the sources", async () => {
    const c = await joined();
    await expect(inside(c, () => putJson('family/family.json', family([])))).rejects.toBeInstanceOf(
      PeopleLiveInSources,
    );
  });

  it('saves your own picture in every circle you are in', async () => {
    const c = await joined();
    const avatar = { library: 'animal' as const, animal: 'fox' as const, color: 'sky' as const };
    expect(await inside(c, () => updatePerson('alice', (p) => ({ ...p, avatar })))).toBe(true);
    expect(getStored<Family>('family/family.json')?.people.alice?.avatar).toEqual(avatar);
    expect(getStored<Family>('circles/crew/family/family.json')?.people.al?.avatar).toEqual(avatar);
  });

  it('knows who has played in either circle, and here', async () => {
    const c = await joined();
    await inside(c, () => putJson('config/member-activation.json', { dave: true }));
    const played = await inside(c, () =>
      getJson<Record<string, boolean>>('config/member-activation.json'),
    );
    expect(played).toEqual({ bob: true, dave: true });
  });

  it('needs an admin of every circle joined', async () => {
    const r = await joinCircles({ name: 'X', sources: ['home', 'crew'] }, 'bob@example.com');
    expect(r).toMatchObject({ ok: false, status: 403 });
    expect(await joinCircles({ name: 'X', sources: ['home'] }, 'alice@example.com')).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it('splits without deleting, and joining again picks up where it left off', async () => {
    const c = await joined();
    expect(
      await joinCircles({ name: 'Again', sources: ['crew', 'home'] }, 'alice@example.com'),
    ).toMatchObject({
      ok: false,
      status: 409,
    });
    const split = await splitCircle(c.id, 'alice@example.com');
    expect(split.ok && split.circle.endedAt).toBeTruthy();
    const paused = getStored<SeasonsConfig>(`circles/${c.id}/config/seasons.json`);
    expect(paused?.currentSeasonNumber).toBeNull();
    // The sources carry on.
    expect(Object.keys((await loadFamily()).people)).toEqual(['alice', 'bob']);

    const again = await joinCircles(
      { name: 'Ignored', sources: ['crew', 'home'] },
      'alice@example.com',
    );
    expect(again).toMatchObject({ ok: true, again: true });
    expect(again.ok && again.circle.id).toBe(c.id);
    expect((await findCircle(c.id))?.endedAt).toBeUndefined();
    const reopened = getStored<SeasonsConfig>(`circles/${c.id}/config/seasons.json`);
    expect(reopened?.currentSeasonNumber).toBe(1);
    expect(reopened?.seasons[0]?.status).toBe('active');
  });
});

describe('reading before a circle is chosen', () => {
  it('reads sign-in data with no circle set (sign-in looks circles up first)', async () => {
    seed();
    setFallbackScope(null);
    try {
      await expect(getJson('circles.json')).resolves.toMatchObject({ version: 1 });
      await expect(putJson('accounts/x.json', {})).resolves.toBeUndefined();
    } finally {
      setFallbackScope({ circleId: 'home', root: true });
    }
  });
});

describe('same person (0018)', () => {
  beforeEach(() => {
    seed();
    // Grandma Jo is remembered in both circles, with no sign-in.
    seedRaw('family/family.json', family(['alice', 'bob', 'jo']));
    seedRaw('circles/crew/family/family.json', family(['al', 'dave', 'grandma']));
    const named = (path: string, id: string) => {
      const f = getStored<Family>(path) as Family;
      seedRaw(path, { ...f, people: { ...f.people, [id]: { ...person(id), name: 'Grandma Jo' } } });
    };
    named('family/family.json', 'jo');
    named('circles/crew/family/family.json', 'grandma');
  });

  const ev = (q: Record<string, string>, body?: unknown) =>
    ({ queryStringParameters: q, body: body ? JSON.stringify(body) : null }) as never;
  const data = (r: { body: string }) => JSON.parse(r.body).data;

  it('suggests her, and one tap makes her one person', async () => {
    const c = await joined();
    const caller = { email: 'alice@example.com', circle: c };
    const { suggestions } = data(await getSame(ev({ circleId: c.id }), 'alice', caller));
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      a: { circleId: 'home', id: 'jo', circleName: 'The Smiths' },
      b: { circleId: 'crew', id: 'grandma', circleName: 'The Crew' },
    });
    const { a, b } = suggestions[0];
    const after = data(
      await postSame(ev({}, { circleId: c.id, a, b, same: true }), 'alice', caller),
    );
    expect(after.suggestions).toEqual([]);
    const people = Object.values((await inside(c, loadFamily)).people);
    expect(people.filter((p) => p.name === 'Grandma Jo')).toHaveLength(1);
    // Kept in the joined circle; the sources are untouched.
    expect(getStored(`circles/${c.id}/config/same-people.json`)).toEqual({
      same: [{ a: { circleId: 'home', id: 'jo' }, b: { circleId: 'crew', id: 'grandma' } }],
      notSame: [],
    });
  });

  it('"not the same" is never asked again', async () => {
    const c = await joined();
    const caller = { email: 'alice@example.com', circle: c };
    const [{ a, b }] = data(await getSame(ev({ circleId: c.id }), 'alice', caller)).suggestions;
    await postSame(ev({}, { circleId: c.id, a, b, same: false }), 'alice', caller);
    expect(data(await getSame(ev({ circleId: c.id }), 'alice', caller)).suggestions).toEqual([]);
    expect(
      Object.values((await inside(c, loadFamily)).people).filter((p) => p.name === 'Grandma Jo'),
    ).toHaveLength(2);
  });

  it('only answers a pair that was suggested, and only for an admin', async () => {
    const c = await joined();
    const alice = { email: 'alice@example.com', circle: c };
    const forced = {
      circleId: c.id,
      a: { circleId: 'home', id: 'bob' },
      b: { circleId: 'crew', id: 'dave' },
      same: true,
    };
    expect((await postSame(ev({}, forced), 'alice', alice)).statusCode).toBe(409);
    const dave = { email: 'dave@example.com', circle: c };
    expect((await getSame(ev({ circleId: c.id }), 'dave', dave)).statusCode).toBe(403);
  });
});

describe('past answers in a joined circle (0018)', () => {
  const answer = (text: string, date = '2026-09-01'): FactAnswerEntry => ({
    date,
    question: 'Favorite food?',
    answer: text,
    fact: '',
    answered: true,
    skipped: false,
    timestamp: `${date}T12:00:00Z`,
    questionType: 'shared',
  });
  const ev = (body?: unknown) => ({ body: body ? JSON.stringify(body) : null }) as never;
  const data = (r: { body: string }) => JSON.parse(r.body).data;

  beforeEach(() => {
    seed();
    invalidateFactHistoryCache();
    seedRaw('facts/answers/alice.json', [answer('Pizza')]);
    seedRaw('facts/answers/bob.json', [answer('Soup')]);
    seedRaw('circles/crew/facts/answers/al.json', [answer('Tacos')]);
    seedRaw('circles/crew/facts/answers/dave.json', [answer('Wings')]);
  });

  const answersHere = async (c: Circle) => {
    invalidateFactHistoryCache();
    const all = await inside(c, getAllFactHistories);
    return Object.fromEntries([...all].map(([id, es]) => [id, es.map((e) => e.answer)]));
  };

  it("shows a family circle's answers, and keeps a friends circle's out until shared", async () => {
    const c = await joined();
    expect(await answersHere(c)).toEqual({ alice: ['Pizza'], bob: ['Soup'] });
    const all = await inside(c, getAllFactHistories);
    expect(all.get('alice')?.[0]?.from).toEqual({ circleId: 'home', name: 'The Smiths' });
  });

  it('lets each person share theirs, or keep them out', async () => {
    const c = await joined();
    const dave = { email: 'dave@example.com', circle: c };
    const before = data(await getSharing(ev(), 'dave', dave)).from;
    expect(before).toEqual([
      { circleId: 'crew', name: 'The Crew', kind: 'friends', shared: false },
    ]);
    await putSharing(ev({ circleId: 'crew', shared: true }), 'dave', dave);
    const alice = { email: 'alice@example.com', circle: c };
    await putSharing(ev({ circleId: 'home', shared: false }), 'alice', alice);
    expect(await answersHere(c)).toEqual({ bob: ['Soup'], dave: ['Wings'] });
    // Someone in both circles chooses for each.
    await putSharing(ev({ circleId: 'crew', shared: true }), 'alice', alice);
    expect((await answersHere(c)).alice).toEqual(['Tacos']);
  });

  it('only for your own circles, and only in a joined circle', async () => {
    const c = await joined();
    const dave = { email: 'dave@example.com', circle: c };
    expect(
      (await putSharing(ev({ circleId: 'home', shared: true }), 'dave', dave)).statusCode,
    ).toBe(404);
    const home = (await findCircle('home')) as Circle;
    const inHome = { email: 'alice@example.com', circle: home };
    expect(data(await getSharing(ev(), 'alice', inHome)).from).toEqual([]);
  });

  it("answering here stores only the joined circle's own; the sources are untouched", async () => {
    const c = await joined();
    // Pizza (from The Smiths) is the same day, but it was another circle's question.
    expect(await inside(c, () => getAnsweredDates('alice'))).toEqual(new Set());
    await inside(c, () => appendFactAnswer('alice', answer('Ramen')));
    expect(getStored<FactAnswerEntry[]>(`circles/${c.id}/facts/answers/alice.json`)).toEqual([
      answer('Ramen'),
    ]);
    expect(getStored<FactAnswerEntry[]>('facts/answers/alice.json')).toEqual([answer('Pizza')]);
    expect((await answersHere(c)).alice).toEqual(['Ramen', 'Pizza']);
    expect(await inside(c, () => getAnsweredDates('alice'))).toEqual(new Set(['2026-09-01']));
  });

  it("a source circle never sees the joined circle's answers", async () => {
    const c = await joined();
    await inside(c, () => appendFactAnswer('alice', answer('Ramen')));
    invalidateFactHistoryCache();
    expect((await getAllFactHistories()).get('alice')?.map((e) => e.answer)).toEqual(['Pizza']);
  });
});
