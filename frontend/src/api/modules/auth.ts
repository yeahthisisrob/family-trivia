// Module: auth
// Google OAuth login + account linking + legacy passphrase validation.

import type { MyCircle } from '@family-trivia/shared';
import { apiService } from '../../services/ApiService';
import { saveCircles } from '../../session';

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
 * Call /auth/google directly — bypasses ApiService's error swallowing
 * so we can read errorType from 401 responses (e.g., NOT_LINKED).
 */
async function authGoogleRaw(body: Record<string, string>): Promise<AuthResponse> {
  const base = await apiService.getApiUrl();
  const res = await fetch(`${base}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  // Unwrap envelope
  const payload = data?.ok === true ? data.data : data;
  if (!res.ok || data?.ok === false) {
    const err: any = new Error(payload?.error || `Auth failed (${res.status})`);
    err.errorType = payload?.errorType;
    throw err;
  }
  const auth = payload as AuthResponse;
  saveCircles(auth.circleId, auth.circles);
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
