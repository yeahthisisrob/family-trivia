// Module: auth
// Google OAuth login + account linking + legacy passphrase validation.

import type { MyCircle } from '@family-trivia/shared';
import { apiService } from '../../shared/api/ApiService';
import { saveCircles } from '../../shared/session/session';

export interface AuthResponse {
  token: string;
  userId: string;
  /** The circle being opened, and every circle this sign-in belongs to. */
  circleId: string;
  circles: MyCircle[];
  email: string;
  name: string;
  picture?: string;
  isNewLink: boolean;
}

/**
 * A request made before sign-in (signing in, opening an invite link). It
 * goes around ApiService, which would treat a 401 as an ended session, and
 * keeps errorType so the screen can say what went wrong (NOT_LINKED,
 * INVITE_EXPIRED…).
 */
export async function publicRequest<T>(path: string, body?: unknown): Promise<T> {
  const base = await apiService.getApiUrl();
  const res = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json().catch(() => null);
  const payload = data?.ok === true ? data.data : data;
  if (!res.ok || data?.ok === false || payload == null) {
    const err = new Error(payload?.error || `Request failed (${res.status})`) as Error & {
      errorType?: string;
    };
    err.errorType = payload?.errorType;
    throw err;
  }
  return payload as T;
}

/** Keep the session's circles once signed in (the rest of the session is the caller's). */
export function rememberCircles(auth: Pick<AuthResponse, 'circleId' | 'circles'>) {
  saveCircles(auth.circleId, auth.circles);
}

async function authGoogleRaw(body: Record<string, string>): Promise<AuthResponse> {
  const auth = await publicRequest<AuthResponse>('/auth/google', body);
  rememberCircles(auth);
  return auth;
}

/**
 * Authenticate with Google — returning user (already linked).
 * Throws with errorType 'NOT_LINKED' if the account isn't linked yet.
 */
export async function loginWithGoogle(googleIdToken: string): Promise<AuthResponse> {
  return authGoogleRaw({ googleIdToken });
}

/**
 * First-time linking: Google account + passphrase (passphrase identifies user).
 */
export async function linkGoogleAccount(
  googleIdToken: string,
  passphrase: string,
): Promise<AuthResponse> {
  return authGoogleRaw({ googleIdToken, passphrase });
}

/** Whether this deployment still needs its first circle (docs/decisions/0029). */
export const setupState = () => publicRequest<{ unstarted: boolean }>('/setup');

/** Start a brand-new deployment's first circle, signed in as its owner. */
export async function startFirstCircle(
  googleIdToken: string,
  c: { name: string; kind: string; themeId: string; yourName: string },
): Promise<AuthResponse> {
  const auth = await publicRequest<AuthResponse>('/auth/start', {
    googleIdToken,
    name: c.yourName,
    circle: { name: c.name, kind: c.kind, themeId: c.themeId },
  });
  rememberCircles(auth);
  return auth;
}
