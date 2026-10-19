vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { putMyAvatar } from '../features/avatar/handlers';
import { loadFamily } from '../services/family/roster';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const put = (avatar: unknown) =>
  putMyAvatar({ body: JSON.stringify({ avatar }) } as APIGatewayProxyEvent, 'alice');

beforeEach(() => {
  resetS3Mock();
  seedRaw('family/family.json', {
    version: 2,
    name: 'The Smiths',
    people: { alice: { id: 'alice', name: 'Alice', participation: 'playing' } },
    ties: [],
    households: {},
  });
});

describe('your picture', () => {
  test('a library picture is saved on you, and null goes back to initials', async () => {
    const choice = { library: 'dicebear', style: 'micah', seed: 'alice-micah-3' };
    expect((await put(choice)).statusCode).toBe(200);
    expect((await loadFamily()).people.alice?.avatar).toEqual(choice);
    expect((await put(null)).statusCode).toBe(200);
    expect((await loadFamily()).people.alice?.avatar).toBeUndefined();
  });

  test('only the library: no uploads, no other styles', async () => {
    expect((await put({ library: 'upload', style: 'micah', seed: 'x' })).statusCode).toBe(400);
    expect((await put({ library: 'dicebear', style: 'bottts', seed: 'x' })).statusCode).toBe(400);
    expect((await put({ library: 'dicebear', style: 'micah', seed: '' })).statusCode).toBe(400);
    expect(
      (await put({ library: 'dicebear', style: 'micah', seed: 'x', tone: 'green' })).statusCode,
    ).toBe(400);
  });
});
