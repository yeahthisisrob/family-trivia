/**
 * Auth middleware — wraps route handlers with JWT verification.
 *
 * Verifies the JWT, finds the circle the request is for (X-Circle) and the
 * caller's id in it, and runs the handler inside that circle's scope.
 * If the token is within 24h of expiry, attaches a refreshed token via
 * the X-Refreshed-Token response header.
 */

import { CIRCLE_HEADER, type Circle } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CORS_HEADERS } from '../config';
import { maybeRefreshJwt, type VerifiedUser, verifyJwt } from '../services/auth';
import { listCircles, type Resolved, resolveCircle, scopeOf } from '../services/circles';
import { logger } from '../services/logger';
import { PeopleLiveInSources, serveInCircle } from '../services/scope';

/** Handler signature for auth-protected routes. */
export type AuthHandler = (
  event: APIGatewayProxyEvent,
  userId: string,
  caller: Caller,
) => Promise<APIGatewayProxyResult>;

/** Who is calling and in which circle, for handlers that need more than the id. */
export interface Caller {
  email: string;
  circle: Circle;
}

/**
 * Who `userId` in a request names. Most routes act for the caller, so the
 * caller's id is forced from the token. A few look at someone else (a profile,
 * a member summary, an admin managing a player); for those `userId` is the
 * person being looked at and only `adminUserId` is forced.
 */
export type UserIdMeaning = 'self' | 'subject';

/**
 * Rewrite identity fields from the verified token, so a request can never act
 * as someone else by sending another id. `adminUserId` is always the caller;
 * `userId` is the caller unless the route says it names a subject.
 */
export function withIdentity(
  event: APIGatewayProxyEvent,
  callerId: string,
  userId: UserIdMeaning,
): APIGatewayProxyEvent {
  const forced: Record<string, string> = { adminUserId: callerId };
  if (userId === 'self') forced.userId = callerId;

  const query = event.queryStringParameters ? { ...event.queryStringParameters } : null;
  if (query) for (const k of Object.keys(forced)) if (k in query) query[k] = forced[k] as string;

  let body = event.body;
  if (body) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        for (const k of Object.keys(forced)) if (k in obj) obj[k] = forced[k];
        body = JSON.stringify(obj);
      }
    } catch {
      // not JSON: nothing to rewrite
    }
  }
  return { ...event, queryStringParameters: query, body };
}

const headerOf = (event: APIGatewayProxyEvent, name: string) =>
  Object.entries(event.headers ?? {}).find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];

/**
 * The circle the request names (X-Circle) and the caller's id in it. A token
 * from before circles carries no email only in local dev; it acts in the
 * root circle as the id it was signed for, and only while there is one.
 */
async function callerInCircle(event: APIGatewayProxyEvent, user: VerifiedUser): Promise<Resolved> {
  const requested = headerOf(event, CIRCLE_HEADER) || undefined;
  if (user.email) return resolveCircle(user.email, requested);
  const circles = await listCircles();
  const [only] = circles;
  if (circles.length === 1 && only?.root && (!requested || requested === only.id))
    return { ok: true, circle: only, userId: user.userId };
  return { ok: false, status: 403, error: 'Sign in again' };
}

/**
 * Wrap a route handler with JWT auth. The handler sees the request with its
 * identity fields set from the token (see withIdentity).
 */
export function requireAuth(handler: AuthHandler, opts: { userId?: UserIdMeaning } = {}) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token) {
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({ ok: false, error: 'Authentication required' }),
        };
      }

      // Verify JWT
      let user: Awaited<ReturnType<typeof verifyJwt>>;
      try {
        user = await verifyJwt(token);
      } catch (err) {
        logger.error('JWT verification crashed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({ ok: false, error: 'Invalid token' }),
        };
      }

      if (!user) {
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({ ok: false, error: 'Invalid or expired token' }),
        };
      }

      // Which circle, and who the caller is in it (docs/decisions/0015)
      const found = await callerInCircle(event, user);
      if (!found.ok) {
        return {
          statusCode: found.status,
          headers: CORS_HEADERS,
          body: JSON.stringify({ ok: false, error: found.error, errorType: 'NOT_IN_CIRCLE' }),
        };
      }
      const { circle, userId } = found;
      logger.appendKeys({ circleId: circle.id });

      // Run the handler with every key it touches scoped to that circle
      const response = await serveInCircle(scopeOf(circle), () =>
        handler(withIdentity(event, userId, opts.userId ?? 'self'), userId, {
          email: user.email,
          circle,
        }),
      );

      // Attach refreshed token if close to expiry (never crash for this)
      try {
        const refreshed = await maybeRefreshJwt(token);
        if (refreshed) {
          if (!response.headers) {
            response.headers = { ...CORS_HEADERS };
          }
          response.headers['X-Refreshed-Token'] = refreshed;
        }
      } catch {
        /* silent */
      }

      return response;
    } catch (err) {
      // A joined circle's people are changed in the circles it joins (0018).
      if (err instanceof PeopleLiveInSources)
        return {
          statusCode: 409,
          headers: CORS_HEADERS,
          body: JSON.stringify({ ok: false, error: err.message, errorType: 'PEOPLE_IN_SOURCES' }),
        };
      // Catch-all — ensures we ALWAYS return a valid API Gateway response
      logger.error('requireAuth unhandled error', {
        path: event.path,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ ok: false, error: 'Internal server error' }),
      };
    }
  };
}
