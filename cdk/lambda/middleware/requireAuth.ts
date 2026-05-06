/**
 * Auth middleware — wraps route handlers with JWT verification.
 *
 * Extracts userId from the JWT `sub` claim and passes it to the handler.
 * If the token is within 24h of expiry, attaches a refreshed token via
 * the X-Refreshed-Token response header.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { verifyJwt, maybeRefreshJwt } from '../services/auth';
import { CORS_HEADERS } from '../config';
import { logger } from '../services/logger';

/** Handler signature for auth-protected routes. */
export type AuthHandler = (
  event: APIGatewayProxyEvent,
  userId: string,
) => Promise<APIGatewayProxyResult>;

/**
 * Wrap a route handler with JWT auth.
 */
export function requireAuth(handler: AuthHandler) {
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
        logger.error('JWT verification crashed', { error: err instanceof Error ? err.message : String(err) });
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
      const response = await handler(event, user.userId);

      // Attach refreshed token if close to expiry (never crash for this)
      try {
        const refreshed = await maybeRefreshJwt(token);
        if (refreshed) {
          if (!response.headers) {
            response.headers = { ...CORS_HEADERS };
          }
          response.headers['X-Refreshed-Token'] = refreshed;
        }
      } catch { /* silent */ }

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
