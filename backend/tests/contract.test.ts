/**
 * Every route the router serves is in the OpenAPI contract
 * (docs/decisions/0008: OpenAPI-first), and the response check that runs
 * under every test (helpers/contract.ts) catches drift.
 */
import type { APIGatewayProxyResult } from 'aws-lambda';
import { getAppearance } from '../features/appearance/handlers';
import {
  checkResponse,
  inContract,
  NOT_IN_CONTRACT,
  responseProblems,
  takeDrift,
} from './helpers/contract';
import { routeTable } from './helpers/routeTable';

const routes = routeTable();
const ok = (data: unknown, statusCode = 200): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ok: true, data }),
});

test('the route table is read from index.ts and every slice', () => {
  expect(routes.length).toBeGreaterThan(100);
  expect(routes.map((r) => r.key)).toEqual(expect.arrayContaining(['GET /family', 'GET /members']));
});

test.each(routes.filter((r) => !(r.key in NOT_IN_CONTRACT)))(
  '$key is in the contract',
  ({ key }) => {
    expect(inContract(key), `${key} missing from api.openapi.yaml`).toBe(true);
  },
);

test.each(Object.entries(NOT_IN_CONTRACT))('%s is still served and still left out (%s)', (key) => {
  expect(routes.map((r) => r.key)).toContain(key);
  expect(inContract(key), `${key} is in the contract now: take it off NOT_IN_CONTRACT`).toBe(false);
});

describe('the response check', () => {
  test('passes a body that fits, inside or outside the { ok, data } envelope', () => {
    expect(responseProblems('GET /appearance', ok({ themeId: null }))).toEqual([]);
    expect(
      responseProblems('GET /appearance', { ...ok(null), body: JSON.stringify({ themeId: null }) }),
    ).toEqual([]);
  });

  test('fails a body that does not fit', () => {
    expect(responseProblems('GET /appearance', ok({ themeId: 7 }))).not.toEqual([]);
  });

  test('fails a success status the operation does not document', () => {
    expect(responseProblems('GET /appearance', ok({ themeId: null }, 201))).toEqual([
      'status 201 is not a documented response',
    ]);
  });

  test('holds undocumented errors to the error envelope', () => {
    const error = (body: unknown): APIGatewayProxyResult => ({
      statusCode: 500,
      body: JSON.stringify(body),
    });
    expect(responseProblems('GET /appearance', error({ ok: false, error: 'Broken' }))).toEqual([]);
    expect(responseProblems('GET /appearance', error({ message: 'Broken' }))).not.toEqual([]);
  });

  test('fails a route the contract does not have', () => {
    expect(responseProblems('GET /no-such-route', ok({}))).toEqual([
      'not in the contract (add it to api.openapi.yaml)',
    ]);
  });

  test('runs on every handler the router serves, and strict mode records drift', async () => {
    const original = await vi.importActual<typeof import('../features/appearance/handlers')>(
      '../features/appearance/handlers',
    );
    expect(getAppearance).not.toBe(original.getAppearance);
    checkResponse(['GET /appearance'], ok({ themeId: 7 }));
    expect(takeDrift()).toEqual([expect.stringContaining('/themeId must be string')]);
  });
});
