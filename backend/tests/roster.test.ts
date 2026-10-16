vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { Family } from '@family-trivia/shared';
import { accountIsPlaying, loadFamily } from '../services/family/roster';
import { getAllUsers, getUsersInGroup, invalidateUserConfigCache } from '../services/users';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const accounts = {
  version: '1',
  lastUpdated: '2026-01-01',
  users: {
    alice: { group: 'smiths', color: '#111' },
    bob: { group: 'smiths', color: '#222' },
    carol: { group: 'joneses', color: '#333' },
    dave: { group: 'joneses', color: '#444' },
  },
};

beforeEach(() => {
  resetS3Mock();
  invalidateUserConfigCache();
  seedRaw('config/users.json', accounts);
});

describe('loadFamily', () => {
  test('reads a version 1 hierarchy when there is no family file yet', async () => {
    seedRaw('family/hierarchy.json', {
      family: {
        name: 'Legacy',
        people: { alice: { name: 'Alice' }, nan: { name: 'Nan' } },
        relationships: [{ type: 'parents-of', parent1: 'nan', children: ['alice'] }],
      },
    });
    const f = await loadFamily();
    expect(f.version).toBe(2);
    expect(f.people.alice?.participation).toBe('playing');
    expect(f.people.nan?.participation).toBe('not-playing');
    expect(f.people.dave?.participation).toBe('playing'); // has an account, not in the tree yet
  });

  test('prefers the version 2 family file', async () => {
    const family: Family = {
      version: 2,
      name: 'V2',
      people: { alice: { id: 'alice', name: 'Alice', participation: 'paused' } },
      ties: [],
      households: {},
    };
    seedRaw('family/family.json', family);
    expect((await loadFamily()).name).toBe('V2');
  });
});

describe('player lists skip people who are not playing right now', () => {
  beforeEach(() => {
    const family: Family = {
      version: 2,
      name: 'Example',
      people: {
        alice: { id: 'alice', name: 'Alice', participation: 'playing' },
        bob: { id: 'bob', name: 'Bob', participation: 'paused' },
        carol: { id: 'carol', name: 'Carol', participation: 'playing', memorial: { died: '2025' } },
      },
      ties: [],
      households: {},
    };
    seedRaw('family/family.json', family);
  });

  test('paused and remembered accounts drop out; unknown accounts stay in', async () => {
    expect(await getAllUsers()).toEqual(['alice', 'dave']);
    expect(await getUsersInGroup('smiths')).toEqual(['alice']);
    expect(await getUsersInGroup('joneses')).toEqual(['dave']);
  });

  test('accountIsPlaying', async () => {
    const f = await loadFamily();
    expect(accountIsPlaying(f, 'alice')).toBe(true);
    expect(accountIsPlaying(f, 'bob')).toBe(false);
    expect(accountIsPlaying(f, 'carol')).toBe(false);
    expect(accountIsPlaying(f, 'someone-new')).toBe(true);
  });
});
