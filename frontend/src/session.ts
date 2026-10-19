// File: frontend/src/session.ts
// Session storage — JWT token + userId persisted across page loads.

import type { CircleKind, MyCircle } from '@family-trivia/shared';

interface SessionData {
  userId: string;
  token: string;
  email?: string;
}

const SESSION_KEY = 'familyTriviaSession';

/** Save a full session after Google auth. */
export function saveSession(userId: string, token: string, email?: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, token, email }));
}

/** Load session. Returns userId only if BOTH userId and token are present. */
export function loadSession(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionData;
    // Require token — old sessions without one are invalid
    if (!data.userId || !data.token) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return data.userId;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

/** Get the JWT token for API calls. */
export function getToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as SessionData).token || null;
  } catch {
    return null;
  }
}

/** Update the token without changing userId (for silent refresh). */
export function updateToken(token: string) {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as SessionData;
    data.token = token;
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    /* */
  }
}

/** Clear session (logout). */
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(CIRCLES_KEY);
}

// ── Circles (docs/decisions/0015) ────────────────────────────────
// Which circle this browser is in, and the others this sign-in can open.
// The id goes out on every request (X-Circle); the server checks it.

const CIRCLES_KEY = 'familyTriviaCircles';

export interface SessionCircles {
  current: string;
  circles: MyCircle[];
}

export function saveCircles(current: string, circles: MyCircle[]) {
  localStorage.setItem(CIRCLES_KEY, JSON.stringify({ current, circles }));
}

export function loadCircles(): SessionCircles | null {
  try {
    const raw = localStorage.getItem(CIRCLES_KEY);
    const data = raw ? (JSON.parse(raw) as SessionCircles) : null;
    return data?.current && Array.isArray(data.circles) ? data : null;
  } catch {
    return null;
  }
}

export const currentCircleId = (): string | null => loadCircles()?.current ?? null;

/** The kind of circle this browser is in. Family until it's known (the first circle always is). */
export const currentCircleKind = (): CircleKind => {
  const c = loadCircles();
  return c?.circles.find((x) => x.id === c.current)?.kind ?? 'family';
};

/** Forget the remembered circle and start over; the server opens their first. */
export function leaveRememberedCircle() {
  localStorage.removeItem(CIRCLES_KEY);
  window.location.assign('/');
}

/** Open another circle: who they are there, then a fresh start of the app in it. */
export function enterCircle(circle: MyCircle, circles: MyCircle[]) {
  saveCircles(circle.id, circles);
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const data = JSON.parse(raw) as SessionData;
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...data, userId: circle.userId }));
    }
  } catch {
    /* */
  }
  window.location.assign('/');
}

const EXPIRED_EVENT = 'ft:session-expired';
let expiring = false;

/**
 * The server said the session is no longer valid. Clear it once and tell the
 * app (AppProvider) to show the sign-in screen, however many requests were in
 * flight when it happened.
 */
export function expireSession() {
  if (expiring) return;
  expiring = true;
  clearSession();
  window.dispatchEvent(new Event(EXPIRED_EVENT));
  setTimeout(() => {
    expiring = false;
  }, 1000);
}

export function onSessionExpired(handler: () => void): () => void {
  window.addEventListener(EXPIRED_EVENT, handler);
  return () => window.removeEventListener(EXPIRED_EVENT, handler);
}
