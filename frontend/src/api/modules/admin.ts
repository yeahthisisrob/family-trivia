// Module: admin
// Admin endpoints not on server data yet (docs/decisions/0035, step 4): a
// person's facts, trivia and game sessions (Player Data), and photo uploads.
// Players, groups, the family tree, seasons and daily questions are read in
// features/admin-people, admin-seasons and admin-questions.

import { apiService } from '../../shared/api/ApiService';

// ── User Data Management APIs ───────────────────────────────────

export interface FactEntry {
  timestamp: string;
  key: string;
  date: string;
  question: string;
  answer: string;
  answered: boolean;
  skipped?: boolean;
  questionType?: 'shared' | 'basic';
  questionIndex?: number;
}

export interface TriviaEntry {
  timestamp: string;
  question: { text: string; category?: string; difficulty?: string };
  correct: boolean;
  selectedAnswer: string | null;
  pointsEarned?: number;
  isCatchingUp?: boolean;
  /** The game mode it came from; older entries carry a flag per mode instead. */
  gameMode?: string;
}

export async function getUserFacts(adminUserId: string, userId: string): Promise<FactEntry[]> {
  const res = await apiService.request<{ facts: FactEntry[]; success: boolean }>(
    `/admin/user-facts?adminUserId=${encodeURIComponent(adminUserId)}&userId=${encodeURIComponent(userId)}`,
    { method: 'GET' },
  );
  return res.facts;
}

export async function updateUserFact(
  adminUserId: string,
  data: {
    userId: string;
    timestamp?: string; // preferred — exact entry identity
    factKey?: string; // legacy fallback
    // Updatable fields:
    answer?: string;
    question?: string;
    newQuestionType?: 'shared' | 'basic';
    newQuestionIndex?: number;
    newDate?: string;
  },
): Promise<void> {
  await apiService.request('/admin/user-facts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, ...data }),
  });
}

export async function deleteUserFact(
  adminUserId: string,
  data: { userId: string; timestamp?: string; factKey?: string },
): Promise<void> {
  await apiService.request('/admin/user-facts', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, ...data }),
  });
}

export async function getUserTrivia(adminUserId: string, userId: string): Promise<TriviaEntry[]> {
  const res = await apiService.request<{ history: TriviaEntry[]; success: boolean }>(
    `/admin/user-trivia?adminUserId=${encodeURIComponent(adminUserId)}&userId=${encodeURIComponent(userId)}`,
    { method: 'GET' },
  );
  return res.history;
}

export async function deleteUserTrivia(
  adminUserId: string,
  data: { userId: string; timestamps: string[] },
): Promise<void> {
  await apiService.request('/admin/user-trivia', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, ...data }),
  });
}

// ── Game Sessions ───────────────────────────────────────────────

export interface GameSessionInfo {
  /** The game's label. */
  type: string;
  /** The game's id (its folder). */
  game: string;
  status: string;
  lastPlayed: string | null;
  details: string;
}

export async function getGameSessions(
  adminUserId: string,
  userId: string,
): Promise<GameSessionInfo[]> {
  const result = await apiService.request<{ sessions: GameSessionInfo[] }>(
    `/admin/game-sessions?adminUserId=${encodeURIComponent(adminUserId)}&userId=${encodeURIComponent(userId)}`,
    { method: 'GET' },
  );
  return result.sessions;
}

export interface StuckSessionInfo {
  userId: string;
  /** The game's label. */
  type: string;
  /** The game's id (its folder). */
  game: string;
  status: string;
  questions: number;
  answered: number;
  startTime: string;
}

export async function getAllStuckSessions(adminUserId: string): Promise<StuckSessionInfo[]> {
  const result = await apiService.request<{ sessions: StuckSessionInfo[] }>(
    `/admin/game-sessions?adminUserId=${encodeURIComponent(adminUserId)}`,
    { method: 'GET' },
  );
  return result.sessions;
}

export async function resetGameSession(
  adminUserId: string,
  /** gameType: a game's id, or 'all'. */
  data: { userId: string; gameType: string },
): Promise<void> {
  await apiService.request('/admin/game-sessions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, ...data }),
  });
}

// ── Media ────────────────────────────────────────────────────────

/**
 * Upload one image to the family's private storage and return its key.
 * The browser sends the file straight to S3 with a short-lived URL.
 */
export async function uploadImage(
  adminUserId: string,
  file: File,
  folder: string,
): Promise<string> {
  const { key, url } = await apiService.request<{ key: string; url: string }>(
    '/admin/media/upload-url',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUserId, contentType: file.type, folder }),
    },
  );
  const put = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return key;
}
