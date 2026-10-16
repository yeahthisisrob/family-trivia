/**
 * Auth middleware — wraps route handlers with JWT verification.
 *
 * Extracts userId from the JWT `sub` claim and passes it to the handler.
 * If the token is within 24h of expiry, attaches a refreshed token via
 * the X-Refreshed-Token response header.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CORS_HEADERS } from '../config';
import { maybeRefreshJwt, verifyJwt } from '../services/auth';
import { logger } from '../services/logger';

/** Handler signature for auth-protected routes. */
export type AuthHandler = (
  event: APIGatewayProxyEvent,
  userId: string,
) => Promise<APIGatewayProxyResult>;

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
      let user;
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

      // Run the handler
      const response = await handler(
        withIdentity(event, user.userId, opts.userId ?? 'self'),
        user.userId,
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
