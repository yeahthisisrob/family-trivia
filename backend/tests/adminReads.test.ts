// The reads behind Admin and Settings (players, groups, the family tree,
// seasons with their letters, daily questions, system info, the settings
// view and the features), each held to its contract entry by the shared
// setup (0034): the frontend types them from it (0035).
vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import { MODEL_CATALOG } from '@family-trivia/shared';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getAdminSettings, getFeatures, putAdminSettings } from '../features/settings/handlers';
import {
  addSeason,
  deleteSeason,
  getDailyQuestions,
  getFamilyTree,
  getGroups,
  getPlayers,
  getSeasons,
  updateFamilyTree,
  updatePlayer,
  updateSeason,
} from '../routes/admin';
import { getSystemInfo } from '../routes/systemInfo';
import { invalidateSeasonsCache } from '../services/seasonService';
import { invalidateUserConfigCache } from '../services/users';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const users = {
  version: '1',
  lastUpdated: '2026-10-01T00:00:00.000Z',
  users: {
    alice: { group: 'smiths', color: '#2e7d32', isAdmin: true, passphrase: 'otter' },
    bob: { group: 'smiths', color: '#1976d2' },
    // Added before groups existed in a friends circle.
    dave: { group: '', color: '#ff9800' },
  },
};

const hierarchy = {
  version: '2',
  family: {
    name: 'The Example Family',
    root: { partners: [{ id: 'alice', name: 'Alice', role: 'grandmother' }] },
    sides: { springfield: { id: 'springfield', name: 'Springfield', color: '#00f', groups: [] } },
    relationships: [],
    people: { alice: { name: 'Alice' }, bob: { name: 'Bob' } },
    groups: {
      smiths: {
        id: 'smiths',
        name: 'The Smiths',
        members: ['alice', 'bob'],
        familySide: 'springfield',
      },
      empty: { id: 'empty', name: 'Nobody yet', members: [] },
    },
  },
};

const seasons = {
  currentSeasonNumber: 2,
  seasons: [
    {
      seasonNumber: 1,
      name: 'Winter',
      status: 'concluded',
      startDate: '2025-12-01',
      endDate: '2026-02-28',
      message: 'Thanks, everyone',
    },
    {
      seasonNumber: 2,
      name: 'Spring',
      status: 'active',
      startDate: '2026-03-01',
      endDate: null,
      message: null,
      pace: 'weekly',
      play: 'teams',
      notes: { start: { title: 'Welcome back', markdown: 'Here we go.' } },
    },
  ],
};

const asks = (query: Record<string, string> = {}, body?: unknown) =>
  ({
    httpMethod: body ? 'PUT' : 'GET',
    queryStringParameters: query,
    body: body ? JSON.stringify(body) : null,
  }) as unknown as APIGatewayProxyEvent;

type Handler = (
  e: APIGatewayProxyEvent,
  userId: string,
) => Promise<{ statusCode: number; body: string }>;
const answer = async (handler: Handler, event: APIGatewayProxyEvent) => {
  const r = await handler(event, 'alice');
  return { status: r.statusCode, data: JSON.parse(r.body).data };
};
const admin = { adminUserId: 'alice' };

beforeEach(() => {
  resetS3Mock();
  invalidateUserConfigCache();
  invalidateSeasonsCache();
  seedRaw('config/users.json', users);
  seedRaw('family/hierarchy.json', hierarchy);
  seedRaw('config/group_descriptions.json', {
    smiths: { description: 'The ones in Springfield', lastUpdated: '2026-10-01' },
  });
  seedRaw('config/seasons.json', seasons);
  seedRaw('config/model-availability.json', {
    // Checked just now: the view uses it instead of asking Bedrock (a day later it asks again).
    checkedAt: new Date().toISOString(),
    models: { [MODEL_CATALOG[0]?.id ?? '']: { ok: false, reason: 'Not enabled in this account' } },
  });
  seedRaw('facts/daily/shared/2026-10-19.json', { question: 'Best pie?', createdBy: 'system' });
});

test('players, with one who has no group yet', async () => {
  const r = await answer(getPlayers, asks(admin));
  expect(r.status).toBe(200);
  expect(r.data.players.map((p: { userId: string }) => p.userId)).toEqual(['alice', 'bob', 'dave']);
  expect(r.data.players[0]).toMatchObject({ passphrase: 'otter', isAdmin: true });
});

test('groups with their side and description, a group with nobody, and the sides', async () => {
  const r = await answer(getGroups, asks(admin));
  expect(r.data.groups).toEqual([
    expect.objectContaining({ groupId: 'smiths', memberCount: 2, side: 'springfield' }),
    expect.objectContaining({ groupId: 'empty', side: null, description: null }),
  ]);
  expect(Object.keys(r.data.sides)).toEqual(['springfield']);
});

test('the family tree, and saving it', async () => {
  const r = await answer(getFamilyTree, asks(admin));
  expect(r.data.rootPartners).toEqual([{ id: 'alice', name: 'Alice', role: 'grandmother' }]);
  const saved = await answer(
    updateFamilyTree,
    asks({}, { ...admin, rootPartners: [{ id: 'alice', name: 'Alice' }], sides: {} }),
  );
  expect(saved.data).toEqual({ success: true });
});

test('seasons with the current one and its letters; adding, changing and deleting one', async () => {
  const r = await answer(getSeasons, asks(admin));
  expect(r.data.currentSeasonNumber).toBe(2);
  expect(r.data.seasons[1].notes.start.title).toBe('Welcome back');

  const added = await answer(
    addSeason,
    asks({}, { ...admin, seasonNumber: 3, name: 'Summer', startDate: '2026-06-01' }),
  );
  expect(added.data).toEqual({ success: true });
  const letters = await answer(
    updateSeason,
    asks({}, { ...admin, seasonNumber: 3, notes: { end: { markdown: 'Thank you.' } } }),
  );
  expect(letters.data).toEqual({ success: true });
  expect((await answer(deleteSeason, asks({}, { ...admin, seasonNumber: 3 }))).data).toEqual({
    success: true,
  });
});

test('between seasons, the current season is null', async () => {
  seedRaw('config/seasons.json', { currentSeasonNumber: null, seasons: [] });
  invalidateSeasonsCache();
  expect((await answer(getSeasons, asks(admin))).data).toEqual({
    currentSeasonNumber: null,
    seasons: [],
    success: true,
  });
});

test('a player changed', async () => {
  const r = await answer(updatePlayer, asks({}, { ...admin, userId: 'bob', color: '#000000' }));
  expect(r.data).toEqual({ success: true });
});

test('the daily questions', async () => {
  const r = await answer(getDailyQuestions, asks(admin));
  expect(r.data.questions).toEqual([
    {
      key: 'facts/daily/shared/2026-10-19.json',
      date: '2026-10-19',
      question: 'Best pie?',
      createdBy: 'system',
      answered: false,
    },
  ]);
});

test('system info, with an active season', async () => {
  const r = await answer(getSystemInfo, asks(admin));
  expect(r.data.health.allHealthy).toBe(true);
  expect(r.data.stats).toMatchObject({ userCount: 3, activeSeason: { name: 'Spring' } });
});

test('system info is for admins only', async () => {
  const r = await getSystemInfo(asks(), 'bob');
  expect(r.statusCode).toBe(403);
});

test('the settings view, saving it, and the features', async () => {
  const view = await answer(getAdminSettings, asks());
  expect(view.status).toBe(200);
  expect(view.data.models[0].availability).toEqual({
    ok: false,
    reason: 'Not enabled in this account',
  });
  expect(
    view.data.settings.find((s: { key: string }) => s.key === 'features.arcade'),
  ).toMatchObject({ value: true, source: 'default' });
  const saved = await answer(putAdminSettings, asks({}, { values: { 'features.arcade': false } }));
  expect(saved.data.settings.find((s: { key: string }) => s.key === 'features.arcade').value).toBe(
    false,
  );
  expect((await answer(getFeatures, asks())).data).toMatchObject({ arcade: false, photos: true });
});
