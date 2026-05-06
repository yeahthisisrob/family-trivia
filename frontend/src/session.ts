// File: frontend/src/session.ts
// Session storage — JWT token + userId persisted across page loads.

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
  } catch { /* */ }
}

/** Clear session (logout). */
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
