/**
 * Every response a backend test gets from a route handler is held to the
 * OpenAPI contract (shared/schemas/api.openapi.yaml, docs/decisions/0034).
 * setup.ts wraps each handler the router serves, so no test has to ask.
 *
 * CONTRACT_RESPONSES picks what happens on drift:
 *   strict (the default): the test that produced it fails
 *   warn:                 logged, the test goes on
 *   off:                  not checked
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Ajv, type ValidateFunction } from 'ajv';
import type { APIGatewayProxyResult } from 'aws-lambda';
import { parse } from 'yaml';
import { logger } from '../../services/logger';

type Mode = 'strict' | 'warn' | 'off';

/**
 * Routes the router serves that the contract leaves out, each with why.
 * Keep it short: the fix is almost always to describe the route.
 */
export const NOT_IN_CONTRACT: Record<string, string> = {};

interface Operation {
  responses?: Record<string, { content?: Record<string, { schema?: unknown }> }>;
}
interface Spec {
  paths: Record<string, Record<string, Operation>>;
}

const SPEC_ID = 'api.openapi';
const spec = parse(
  readFileSync(join(import.meta.dirname, '../../../shared/schemas/api.openapi.yaml'), 'utf8'),
) as Spec;

// OpenAPI 3.0 schemas: `nullable` is OpenAPI's, unknown keywords (example)
// are documentation, and the two formats the contract uses are checked here.
const ajv = new Ajv({ strict: false, allErrors: true });
ajv.addFormat('date-time', (value: string) => !Number.isNaN(Date.parse(value)));
ajv.addFormat('uri', (value: string) => URL.canParse(value));
ajv.addSchema(spec, SPEC_ID);

/** Errors without a documented body share one envelope (config.ts errorResponse). */
const errorEnvelope = ajv.compile({
  type: 'object',
  required: ['ok', 'error'],
  properties: { ok: { const: false }, error: { type: 'string' } },
});

const pointer = (...parts: string[]) =>
  parts.map((p) => p.replaceAll('~', '~0').replaceAll('/', '~1')).join('/');

const validators = new Map<string, ValidateFunction>();
function validatorFor(path: string, method: string, status: string): ValidateFunction {
  const id = `${SPEC_ID}#/${pointer('paths', path, method, 'responses', status, 'content', 'application/json', 'schema')}`;
  let validate = validators.get(id);
  if (!validate) {
    validate = ajv.compile({ $ref: id });
    validators.set(id, validate);
  }
  return validate;
}

function messages(validate: ValidateFunction): string[] {
  return (validate.errors ?? []).map(
    (e) =>
      `${e.instancePath || 'body'} ${e.message}${e.params && 'additionalProperty' in e.params ? ` (${e.params.additionalProperty})` : ''}`,
  );
}

/** 'GET /family' as the contract's path and lower-case method. */
function splitKey(routeKey: string): { path: string; method: string } {
  const [verb = '', path = ''] = routeKey.split(' ');
  return { path, method: verb.toLowerCase() };
}

/** Whether the contract describes this route ('GET /family'). */
export function inContract(routeKey: string): boolean {
  const { path, method } = splitKey(routeKey);
  return Boolean(spec.paths[path]?.[method]);
}

/** What is wrong with a handler's response for its route; empty when it fits. */
export function responseProblems(routeKey: string, response: APIGatewayProxyResult): string[] {
  if (routeKey in NOT_IN_CONTRACT) return [];
  const { path, method } = splitKey(routeKey);
  const operation = spec.paths[path]?.[method];
  if (!operation) return ['not in the contract (add it to api.openapi.yaml)'];

  const contentType = Object.entries(response.headers ?? {}).find(
    ([name]) => name.toLowerCase() === 'content-type',
  )?.[1];
  if (response.isBase64Encoded || (contentType && !String(contentType).includes('json'))) return [];

  let body: unknown;
  try {
    body = response.body ? JSON.parse(response.body) : undefined;
  } catch {
    return ['body is not JSON'];
  }

  const status = String(response.statusCode);
  const responses = operation.responses ?? {};
  const documented = [status, `${status[0]}XX`, 'default'].find((s) => s in responses);
  if (!documented) {
    if (response.statusCode < 400) return [`status ${status} is not a documented response`];
    return errorEnvelope(body) ? [] : messages(errorEnvelope);
  }
  if (!responses[documented]?.content?.['application/json']?.schema) {
    // Documented without a body schema: an error still has the envelope.
    if (response.statusCode < 400) return [];
    return errorEnvelope(body) ? [] : messages(errorEnvelope);
  }

  // The contract describes `data` inside the { ok: true, data } envelope
  // (the client unwraps it); a body without the envelope is checked whole.
  const payload =
    body && typeof body === 'object' && (body as { ok?: unknown }).ok === true && 'data' in body
      ? (body as { data: unknown }).data
      : body;
  const validate = validatorFor(path, method, documented);
  return validate(payload) ? [] : messages(validate);
}

function mode(): Mode {
  const value = process.env.CONTRACT_RESPONSES ?? 'strict';
  if (value === 'strict' || value === 'warn' || value === 'off') return value;
  throw new Error(`CONTRACT_RESPONSES must be strict, warn or off, not "${value}"`);
}

const drift: string[] = [];

/**
 * Check a response for the routes its handler serves (one handler can serve
 * two, as GET and POST): it fits when it fits any of them.
 */
export function checkResponse(routeKeys: string[], response: APIGatewayProxyResult): void {
  const current = mode();
  if (current === 'off' || !response || typeof response.statusCode !== 'number') return;
  const found = routeKeys.map((key) => ({ key, problems: responseProblems(key, response) }));
  if (found.some((f) => f.problems.length === 0)) return;
  const report = found
    .map((f) => `${f.key} ${response.statusCode}:\n  - ${f.problems.join('\n  - ')}`)
    .join('\n');
  if (current === 'strict') drift.push(report);
  else logger.warn('A response does not fit the OpenAPI contract', { report });
}

/** Take (and clear) the drift strict mode recorded; setup.ts fails the test on it. */
export function takeDrift(): string[] {
  return drift.splice(0, drift.length);
}
