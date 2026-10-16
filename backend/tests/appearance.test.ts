vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getAppearance, saveAppearance } from '../features/appearance/handlers';
import { invalidateUserConfigCache } from '../services/users';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const ev = (body: unknown) => ({ body: JSON.stringify(body) }) as APIGatewayProxyEvent;

beforeEach(() => {
  resetS3Mock();
  invalidateUserConfigCache();
  seedRaw('config/users.json', {
    users: {
      alice: { group: 'g', color: '#000', isAdmin: true },
      bob: { group: 'g', color: '#1' },
    },
  });
});

test('the family theme defaults to none, admins set it, others cannot', async () => {
  expect(
    JSON.parse((await getAppearance({} as APIGatewayProxyEvent)).body).data.themeId,
  ).toBeNull();
  expect((await saveAppearance(ev({ themeId: 'garden' }), 'bob')).statusCode).toBe(403);
  expect((await saveAppearance(ev({ themeId: '<script>' }), 'alice')).statusCode).toBe(400);
  expect((await saveAppearance(ev({ themeId: 'garden' }), 'alice')).statusCode).toBe(200);
  expect(JSON.parse((await getAppearance({} as APIGatewayProxyEvent)).body).data.themeId).toBe(
    'garden',
  );
});
