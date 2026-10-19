vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { putMyAvatar } from '../features/avatar/handlers';
import { picturePrompt } from '../features/avatar/pictures';
import { loadFamily } from '../services/family/roster';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const put = (avatar: unknown, who = 'alice') =>
  putMyAvatar({ body: JSON.stringify({ avatar }) } as APIGatewayProxyEvent, who);
const made = 'media/avatars/alice/0b6a1c4e-2f7d-4c1e-9a3b-5d8e7f6a1b2c.webp';

beforeEach(() => {
  resetS3Mock();
  seedRaw('family/family.json', {
    version: 2,
    name: 'The Smiths',
    people: {
      alice: { id: 'alice', name: 'Alice', participation: 'playing' },
      bob: { id: 'bob', name: 'Bob', participation: 'playing' },
    },
    ties: [],
    households: {},
  });
  seedRaw(made, 'webp');
});

describe('your picture', () => {
  test('an animal on a color, or a picture made for you; null goes back to initials', async () => {
    const animal = { library: 'animal', animal: 'fox', color: 'mint' };
    expect((await put(animal)).statusCode).toBe(200);
    expect((await loadFamily()).people.alice?.avatar).toEqual(animal);
    expect((await put({ library: 'ai', key: made })).statusCode).toBe(200);
    expect((await put(null)).statusCode).toBe(200);
    expect((await loadFamily()).people.alice?.avatar).toBeUndefined();
  });

  test('only the bundled animals, and only a picture that was made for you', async () => {
    expect((await put({ library: 'animal', animal: 'dinosaur', color: 'mint' })).statusCode).toBe(
      400,
    );
    expect((await put({ library: 'animal', animal: 'fox', color: 'neon' })).statusCode).toBe(400);
    expect((await put({ library: 'upload', key: made })).statusCode).toBe(400);
    // Someone else's picture, or one that was never made.
    expect((await put({ library: 'ai', key: made }, 'bob')).statusCode).toBe(400);
    expect((await put({ library: 'ai', key: made.replace('0b6a', '1111') })).statusCode).toBe(400);
  });

  test('the picture is of what they love, or their words, and never a person', () => {
    expect(picturePrompt(['the beach', 'tacos'])).toMatch(/loves the beach, tacos/);
    expect(picturePrompt([], 'a fox with headphones')).toMatch(/of a fox with headphones/);
    expect(picturePrompt(['x'])).toMatch(/No people, no human faces, no text/);
  });
});
