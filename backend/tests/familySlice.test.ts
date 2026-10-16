vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);
vi.mock('../services/media', () => ({ isMediaKey: () => false, readUrl: async () => null }));

import type { Family } from '@family-trivia/shared';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getFamily, saveFamily } from '../features/family/handlers';
import { invalidateUserConfigCache } from '../services/users';
import { getStored, resetS3Mock, seedRaw } from './helpers/s3Mock';

const body = (family: unknown) => ({ body: JSON.stringify({ family }) }) as APIGatewayProxyEvent;
const json = (r: { body: string }) => JSON.parse(r.body);

const family: Family = {
  version: 2,
  name: 'Example',
  people: {
    alice: { id: 'alice', name: 'Alice', participation: 'playing' },
    grace: {
      id: 'grace',
      name: 'Grace',
      participation: 'not-playing',
      memorial: { died: '2025-01-02' },
    },
  },
  ties: [{ id: 't1', type: 'parent', parent: 'grace', child: 'alice', kind: 'birth' }],
  households: {},
};

beforeEach(() => {
  resetS3Mock();
  invalidateUserConfigCache();
  seedRaw('config/users.json', {
    version: '1',
    lastUpdated: '',
    users: {
      alice: { group: 'g', color: '#000', isAdmin: true },
      bob: { group: 'g', color: '#111' },
    },
  });
  seedRaw('family/hierarchy.json', { family: { people: { alice: { name: 'Alice' } } } });
});

describe('saving the family', () => {
  test('only admins can save', async () => {
    const r = await saveFamily(body(family), 'bob');
    expect(r.statusCode).toBe(403);
  });

  test('problems are explained and nothing is written', async () => {
    const r = await saveFamily(
      body({
        ...family,
        ties: [{ id: 'x', type: 'kin', a: 'alice', b: 'nobody', relation: 'cousin' }],
      }),
      'alice',
    );
    expect(r.statusCode).toBe(400);
    expect(json(r).details).toContain("isn't in the family");
    expect(getStored('family/family.json')).toBeUndefined();
  });

  test('a save keeps the version it replaces', async () => {
    const r = await saveFamily(body(family), 'alice');
    expect(r.statusCode).toBe(200);
    expect(getStored<Family>('family/family.json')?.people.grace?.memorial?.died).toBe(
      '2025-01-02',
    );
    const { s3MockModule } = await import('./helpers/s3Mock');
    const keys = await s3MockModule.listObjects('family/history/');
    expect(keys.length).toBe(1);
  });

  test('everyone signed in can read the family', async () => {
    seedRaw('family/family.json', family);
    const r = await getFamily({} as APIGatewayProxyEvent);
    expect(json(r).data.family.people.grace.memorial.died).toBe('2025-01-02');
  });
});
