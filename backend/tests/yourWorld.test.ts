vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import { yourWorld } from '../features/your-world/service';
import { rebuildMemberships } from '../services/circles';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const fam = (people: Record<string, string>, ties: unknown[] = []) => ({
  version: 2,
  name: 'x',
  people: Object.fromEntries(
    Object.entries(people).map(([id, name]) => [id, { id, name, participation: 'playing' }]),
  ),
  ties,
  households: {},
});
const loves = (id: string, name: string) => ({
  personId: id,
  read: [],
  items: [{ kind: 'place', name, says: name, from: 't' }],
  persona: null,
  updatedAt: 't',
});

beforeEach(() => {
  resetS3Mock();
  seedRaw('circles.json', {
    version: 1,
    circles: [
      { id: 'home', name: 'The Smiths', kind: 'family', root: true },
      { id: 'crew', name: 'The Crew', kind: 'friends' },
    ],
  });
  // Alice is in both; Bob only in the family, Dee only in the crew. Both love the beach.
  seedRaw(
    'family/family.json',
    fam({ alice: 'Alice', bob: 'Bob' }, [
      { id: 't1', type: 'kin', a: 'alice', b: 'bob', relation: 'sibling' },
    ]),
  );
  seedRaw('config/google-auth-map.json', {
    'alice@example.com': 'alice',
    'bob@example.com': 'bob',
  });
  seedRaw('knowledge/people/bob.json', loves('bob', 'the beach'));
  seedRaw(
    'circles/crew/family/family.json',
    fam({ al: 'Al', dee: 'Dee' }, [{ id: 'f1', type: 'friend', a: 'al', b: 'dee' }]),
  );
  seedRaw('circles/crew/config/google-auth-map.json', {
    'alice@example.com': 'al',
    'dee@example.com': 'dee',
  });
  seedRaw('circles/crew/knowledge/people/dee.json', loves('dee', 'the beach'));
});

describe('your world', () => {
  test('both circles, you as the bridge, a thread between them, and who should meet', async () => {
    await rebuildMemberships('alice@example.com');
    const w = await yourWorld('alice@example.com');
    expect(w.enough).toBe(true);
    expect(w.circles.map((c) => c.id)).toEqual(['home', 'crew']);
    expect(
      w.nodes
        .filter((n) => n.me)
        .map((n) => n.id)
        .sort(),
    ).toEqual(['crew:al', 'home:alice']);
    expect(w.links).toContainEqual({ a: 'home:alice', b: 'crew:al', kind: 'same' });
    expect(w.threads).toEqual([{ name: 'beach', kind: 'place', people: ['home:bob', 'crew:dee'] }]);
    expect(w.meet).toEqual([{ a: 'home:bob', b: 'crew:dee', because: 'beach' }]);
  });

  test('someone in one circle sees nothing across', async () => {
    await rebuildMemberships('bob@example.com');
    const w = await yourWorld('bob@example.com');
    expect(w).toMatchObject({ enough: false, nodes: [], threads: [] });
  });
});
