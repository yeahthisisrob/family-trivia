import type { APIGatewayProxyEvent } from 'aws-lambda';
import { withIdentity } from '../middleware/requireAuth';

const event = (over: Partial<APIGatewayProxyEvent>) =>
  ({
    httpMethod: 'POST',
    path: '/x',
    headers: {},
    queryStringParameters: null,
    body: null,
    ...over,
  }) as APIGatewayProxyEvent;

describe('withIdentity', () => {
  test('a caller cannot act as someone else through the query string', () => {
    const out = withIdentity(
      event({ queryStringParameters: { userId: 'bob', other: '1' } }),
      'alice',
      'self',
    );
    expect(out.queryStringParameters).toEqual({ userId: 'alice', other: '1' });
  });

  test('a caller cannot act as someone else through the body', () => {
    const out = withIdentity(
      event({ body: JSON.stringify({ userId: 'bob', answer: 'A' }) }),
      'alice',
      'self',
    );
    expect(JSON.parse(out.body ?? '')).toEqual({ userId: 'alice', answer: 'A' });
  });

  test('a non-admin cannot borrow an admin id', () => {
    const out = withIdentity(
      event({
        queryStringParameters: { adminUserId: 'admin' },
        body: JSON.stringify({ adminUserId: 'admin', userId: 'carol' }),
      }),
      'alice',
      'subject',
    );
    expect(out.queryStringParameters?.adminUserId).toBe('alice');
    expect(JSON.parse(out.body ?? '')).toEqual({ adminUserId: 'alice', userId: 'carol' });
  });

  test('on subject routes userId keeps naming the person being looked at', () => {
    const out = withIdentity(
      event({ queryStringParameters: { userId: 'carol' } }),
      'alice',
      'subject',
    );
    expect(out.queryStringParameters?.userId).toBe('carol');
  });

  test('fields the request did not send are not added, and non-JSON bodies pass through', () => {
    expect(
      withIdentity(event({ queryStringParameters: { a: '1' } }), 'alice', 'self')
        .queryStringParameters,
    ).toEqual({ a: '1' });
    expect(withIdentity(event({ body: 'not json' }), 'alice', 'self').body).toBe('not json');
  });
});
