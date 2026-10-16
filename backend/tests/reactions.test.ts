vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getReactions, putReaction } from '../features/reactions/handlers';
import { getNotifications } from '../services/notificationService';
import { readInbox } from '../services/reactions';
import { resetS3Mock } from './helpers/s3Mock';

const put = (body: unknown, who: string) =>
  putReaction({ body: JSON.stringify(body) } as APIGatewayProxyEvent, who).then((r) => ({
    status: r.statusCode,
    data: JSON.parse(r.body).data,
  }));
const get = (ids: string, who: string) =>
  getReactions(
    { queryStringParameters: { contentType: 'fact', ids } } as unknown as APIGatewayProxyEvent,
    who,
  ).then((r) => JSON.parse(r.body).data.reactions);

const fact = 'alice_2026-10-01T12:00:00.000Z';

beforeEach(() => resetS3Mock());

test('one reaction per person; the same tap takes it back', async () => {
  await put({ contentType: 'fact', contentId: fact, reaction: 'love' }, 'bob');
  await put({ contentType: 'fact', contentId: fact, reaction: 'laugh' }, 'bob');
  await put({ contentType: 'fact', contentId: fact, reaction: 'same' }, 'carol');
  let r = (await get(fact, 'bob'))[fact];
  expect(r.mine).toBe('laugh');
  expect(r.by).toHaveLength(2);

  await put({ contentType: 'fact', contentId: fact, reaction: 'laugh' }, 'bob');
  r = (await get(fact, 'bob'))[fact];
  expect(r.mine).toBeNull();
  expect(r.by).toEqual([{ userId: 'carol', reaction: 'same' }]);
});

test('the owner hears about it, never about their own', async () => {
  await put({ contentType: 'fact', contentId: fact, reaction: 'hug' }, 'bob');
  await put({ contentType: 'fact', contentId: fact, reaction: 'love' }, 'alice');
  const inbox = await readInbox('alice');
  expect(inbox.map((e) => e.userId)).toEqual(['bob']);
  const n = await getNotifications('alice');
  expect(n.items.some((i) => i.type === 'reaction' && i.reactionUserId === 'bob')).toBe(true);
});

test('rejects unknown reactions and bad ids', async () => {
  expect(
    (await put({ contentType: 'fact', contentId: fact, reaction: 'angry' }, 'bob')).status,
  ).toBe(400);
  expect(
    (await put({ contentType: 'fact', contentId: '../x', reaction: 'love' }, 'bob')).status,
  ).toBe(400);
  expect(
    (await put({ contentType: 'album', contentId: fact, reaction: 'love' }, 'bob')).status,
  ).toBe(400);
});
