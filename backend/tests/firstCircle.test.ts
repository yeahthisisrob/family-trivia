vi.hoisted(() => {
  process.env.JWT_SECRET = 'x'.repeat(40); // test-only signing key
});
vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);
vi.mock('../services/auth', async (orig) => ({
  ...(await orig<typeof import('../services/auth')>()),
  verifyGoogleToken: async (t: string) =>
    t === 'good' ? { email: 'alice@example.com', name: 'Alice A', sub: 'g1' } : null,
}));

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getSetup, startFirst } from '../features/circles/handlers';
import { isUnstarted } from '../services/circles';
import { getStored, resetS3Mock, seedRaw } from './helpers/s3Mock';

const start = (body: unknown) => startFirst({ body: JSON.stringify(body) } as APIGatewayProxyEvent);
const fresh = {
  googleIdToken: 'good',
  name: 'Alice',
  circle: { name: 'The Crew', kind: 'friends', themeId: 'sunset' },
};

beforeEach(() => resetS3Mock());

describe('a brand-new deployment', () => {
  test('the first sign-in starts the first circle, owner and all, and only once', async () => {
    expect(JSON.parse((await getSetup()).body).data).toEqual({ unstarted: true });
    const r = await start(fresh);
    expect(r.statusCode).toBe(200);
    const session = JSON.parse(r.body).data;
    expect(session).toMatchObject({ userId: 'alice', circleId: 'home' });
    expect(getStored('circles.json')).toMatchObject({
      circles: [{ id: 'home', name: 'The Crew', kind: 'friends', root: true }],
    });
    // The root circle is the bucket root: an admin, the sign-in, the look, Season 1.
    expect(
      getStored<{ users: Record<string, { isAdmin?: boolean }> }>('config/users.json')?.users.alice
        ?.isAdmin,
    ).toBe(true);
    expect(getStored('config/google-auth-map.json')).toEqual({ 'alice@example.com': 'alice' });
    expect(getStored('config/appearance.json')).toEqual({ themeId: 'sunset' });
    expect(
      getStored<{ currentSeasonNumber: number }>('config/seasons.json')?.currentSeasonNumber,
    ).toBe(1);

    expect(await isUnstarted()).toBe(false);
    expect((await start(fresh)).statusCode).toBe(409);
  });

  test("a deployment that's already running is never started over", async () => {
    seedRaw('config/users.json', { users: { rob: { isAdmin: true } } });
    expect(await isUnstarted()).toBe(false);
    expect((await start(fresh)).statusCode).toBe(409);
  });

  test('a bad token or a missing kind is refused', async () => {
    expect((await start({ ...fresh, googleIdToken: 'bad' })).statusCode).toBe(401);
    expect((await start({ ...fresh, circle: { name: 'X' } })).statusCode).toBe(400);
  });
});
