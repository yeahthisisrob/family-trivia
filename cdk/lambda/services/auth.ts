/**
 * Auth Service — JWT signing/verification + Google OAuth token validation.
 *
 * JWTs are HS256-signed with a secret from the JWT_SECRET env var.
 * Google ID tokens are verified against Google's JWKS endpoint.
 */

import * as jose from 'jose';
import { logger } from './logger';

const JWT_SECRET = process.env.JWT_SECRET || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const JWT_EXPIRY = '7d';             // token lifetime
const REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000; // refresh if <1 day left

// Cached Google JWKS key set (stays warm on hot Lambdas)
let googleJWKS: ReturnType<typeof jose.createRemoteJWKSet>;

function getGoogleJWKS() {
  if (!googleJWKS) {
    googleJWKS = jose.createRemoteJWKSet(
      new URL('https://www.googleapis.com/oauth2/v3/certs'),
    );
  }
  return googleJWKS;
}

// ── JWT signing ──────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;   // userId
  email: string; // Google email
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new jose.SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(secret);
}

// ── JWT verification ─────────────────────────────────────────────

export interface VerifiedUser {
  userId: string;
  email: string;
}

export async function verifyJwt(token: string): Promise<VerifiedUser | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      email: (payload.email as string) || '',
    };
  } catch (err) {
    logger.debug('JWT verification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Check if a verified JWT is close to expiry (within REFRESH_WINDOW_MS).
 * If so, issue a fresh token. Returns null if no refresh needed.
 */
export async function maybeRefreshJwt(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
    if (!payload.sub || !payload.exp) return null;

    const expiresAt = payload.exp * 1000;
    if (expiresAt - Date.now() < REFRESH_WINDOW_MS) {
      return signJwt({
        sub: payload.sub,
        email: (payload.email as string) || '',
      });
    }
    return null;
  } catch {
    return null;
  }
}

// ── Google ID token verification ─────────────────────────────────

export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
}

/**
 * Verify a Google ID token and extract the user's email + name.
 * Returns null if the token is invalid, expired, or for the wrong client.
 */
export async function verifyGoogleToken(idToken: string): Promise<GoogleUser | null> {
  try {
    const jwks = getGoogleJWKS();
    const { payload } = await jose.jwtVerify(idToken, jwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: GOOGLE_CLIENT_ID,
    });

    const email = payload.email as string;
    if (!email) {
      logger.warn('Google token missing email claim');
      return null;
    }

    return {
      email,
      name: (payload.name as string) || email,
      picture: payload.picture as string | undefined,
    };
  } catch (err) {
    logger.warn('Google token verification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
