vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getComments, getCounts, postComment } from '../features/comments/handlers';
import { getAllThreads } from '../services/commentsService';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const post = (body: unknown, who: string) =>
  postComment({ body: JSON.stringify(body) } as APIGatewayProxyEvent, who).then((r) => ({
    status: r.statusCode,
    data: JSON.parse(r.body).data,
  }));
const query = (q: Record<string, string>) =>
  ({ queryStringParameters: q }) as unknown as APIGatewayProxyEvent;
const data = (r: { body: string }) => JSON.parse(r.body).data;

const fact = 'alice_2026-10-01T12:00:00.000Z';

beforeEach(() => resetS3Mock());

test('a comment is the caller’s, whatever the body says', async () => {
  const r = await post(
    { contentType: 'fact', contentId: fact, text: '  so true ', userId: 'x' },
    'bob',
  );
  expect(r.status).toBe(201);
  expect(r.data.comment).toMatchObject({ userId: 'bob', text: 'so true' });

  const { thread } = data(await getComments(query({ contentType: 'fact', contentId: fact })));
  expect(thread.comments.map((c: { userId: string }) => c.userId)).toEqual(['bob']);
});

test('albums and arcade games take comments too', async () => {
  for (const contentType of ['album', 'arcade']) {
    expect((await post({ contentType, contentId: 'x1', text: 'hi' }, 'bob')).status).toBe(201);
  }
});

test('turns away empty, oversized, unknown and path-like input', async () => {
  const bad = [
    { contentType: 'fact', contentId: fact, text: '   ' },
    { contentType: 'fact', contentId: fact, text: 'x'.repeat(2001) },
    { contentType: 'poll', contentId: fact, text: 'hi' },
    { contentType: 'fact', contentId: '../secrets', text: 'hi' },
  ];
  for (const b of bad) expect((await post(b, 'bob')).status).toBe(400);
});

test('counts and the last three commenters, newest first', async () => {
  for (const who of ['bob', 'carol', 'bob', 'dee', 'eve'])
    await post({ contentType: 'fact', contentId: fact, text: 'hi' }, who);
  const r = data(await getCounts(query({ contentType: 'fact', ids: `${fact},nobody_1` })));
  expect(r.counts).toEqual({ [fact]: 5, nobody_1: 0 });
  expect(r.commenters[fact]).toEqual(['eve', 'dee', 'bob']);
});

test('every thread of a type, for notifications', async () => {
  seedRaw(`comments/trivia/${fact}.json`, { comments: [{ id: '1', userId: 'bob', text: 'a' }] });
  const threads = await getAllThreads('trivia');
  expect(threads).toHaveLength(1);
  expect(threads[0]).toMatchObject({ contentType: 'trivia', contentId: fact });
});
