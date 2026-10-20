/**
 * Requests typed by the OpenAPI contract (shared/schemas/api.openapi.yaml,
 * generated into shared/generated). A path and method that the contract does
 * not describe don't compile, and the answer has the contract's type: the
 * `data` inside the `{ ok, data }` envelope, which ApiService unwraps (0034).
 */
import type { paths } from '@family-trivia/shared/generated';
import { apiService } from './ApiService';

type Method = 'get' | 'post' | 'put' | 'delete';

export type ApiPath = keyof paths;

type Operation<P extends ApiPath, M extends Method> = paths[P][M];

/** What the route answers with a 200. */
export type ResponseOf<P extends ApiPath, M extends Method = 'get'> =
  Operation<P, M> extends {
    responses: { 200: { content: { 'application/json': infer T } } };
  }
    ? T
    : never;

type BodyOf<P extends ApiPath, M extends Method> =
  NonNullable<Operation<P, M>> extends {
    requestBody?: { content: { 'application/json': infer B } };
  }
    ? B
    : never;

export interface CallOptions<P extends ApiPath, M extends Method> {
  method?: M;
  /** The query string, e.g. `{ limit: 11 }`. */
  query?: Record<string, string | number>;
  body?: BodyOf<P, M>;
  /** Ask in this circle instead of the tab's (server-data queries do). */
  circle?: string | null;
}

/** One request through ApiService (its retries, its cap on requests in flight, ApiError). */
export function callApi<P extends ApiPath, M extends Method = 'get'>(
  path: P,
  { method, query, body, circle }: CallOptions<P, M> = {},
): Promise<ResponseOf<P, M>> {
  const search = query
    ? `?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}`
    : '';
  return apiService.request<ResponseOf<P, M>>(`${path}${search}`, {
    method: (method ?? 'get').toUpperCase(),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(circle === undefined ? {} : { circle }),
  });
}
