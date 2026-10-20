vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { Circle, Family, FamilyPerson, SeasonsConfig } from '@family-trivia/shared';
import {
  findCircle,
  joinCircles,
  memberIn,
  myCircles,
  resolveCircle,
  scopeOf,
  splitCircle,
} from '../services/circles';
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
