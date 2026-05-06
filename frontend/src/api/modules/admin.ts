// Module: admin
// Admin CRUD endpoints for players, groups, family tree, and seasons

import { apiService } from '../../services/ApiService';

// ── Types ────────────────────────────────────────────────────────

export interface PlayerConfig {
  userId: string;
  group: string;
  color: string;
  passphrase?: string;
  isAdmin?: boolean;
  side?: string;
}

export interface GroupConfig {
  groupId: string;
  name: string;
  memberCount: number;
  members: string[];
  side: string | null;
  description: string | null;
}

export interface SideConfig {
  id: string;
  name: string;
  color: string;
  groups: string[];
}

export interface SeasonConfig {
  seasonNumber: number;
  name: string;
  startDate: string;
  endDate: string | null;
  status: string;
  message?: string | null;
}

// ── Player APIs ──────────────────────────────────────────────────

export async function getPlayers(adminUserId: string): Promise<PlayerConfig[]> {
  const res = await apiService.request<{ players: PlayerConfig[]; success: boolean }>(
    `/admin/players?adminUserId=${encodeURIComponent(adminUserId)}`,
    { method: 'GET' },
  );
  return res.players;
}

export async function addPlayer(
  adminUserId: string,
  data: { userId: string; group: string; color: string; passphrase?: string; isAdmin?: boolean },
): Promise<void> {
  await apiService.request('/admin/players', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, ...data }),
  });
}

export async function updatePlayer(
  adminUserId: string,
  data: { userId: string; group?: string; color?: string; passphrase?: string; isAdmin?: boolean },
): Promise<void> {
  await apiService.request('/admin/players', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, ...data }),
  });
}

export async function deletePlayer(adminUserId: string, userId: string): Promise<void> {
  await apiService.request('/admin/players', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, userId }),
  });
}

// ── Group APIs ───────────────────────────────────────────────────

export async function getGroups(
  adminUserId: string,
): Promise<{ groups: GroupConfig[]; sides: Record<string, SideConfig> }> {
  const res = await apiService.request<{
    groups: GroupConfig[];
    sides: Record<string, SideConfig>;
    success: boolean;
  }>(`/admin/groups?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'GET' });
  return { groups: res.groups, sides: res.sides };
}

export async function addGroup(
  adminUserId: string,
  data: { groupId: string; name: string; description?: string; side?: string },
): Promise<void> {
  await apiService.request('/admin/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, ...data }),
  });
}

export async function updateGroup(
  adminUserId: string,
  data: { groupId: string; name?: string; description?: string; side?: string },
): Promise<void> {
  await apiService.request('/admin/groups', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, ...data }),
  });
}

export async function deleteGroup(adminUserId: string, groupId: string): Promise<void> {
  await apiService.request('/admin/groups', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, groupId }),
  });
}

// ── Family Tree APIs ─────────────────────────────────────────────

export async function getFamilyTree(adminUserId: string): Promise<{
  rootPartners: { id: string; name: string; role?: string }[];
  sides: Record<string, SideConfig>;
}> {
  const res = await apiService.request<{
    rootPartners: { id: string; name: string; role?: string }[];
    sides: Record<string, SideConfig>;
    success: boolean;
  }>(`/admin/family-tree?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'GET' });
  return { rootPartners: res.rootPartners, sides: res.sides };
}

export async function updateFamilyTree(
  adminUserId: string,
  data: {
    rootPartners?: { id: string; name: string; role?: string }[];
    sides?: Record<string, SideConfig>;
  },
): Promise<void> {
  await apiService.request('/admin/family-tree', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, ...data }),
  });
}

// ── Season APIs ──────────────────────────────────────────────────

export async function getSeasons(
  adminUserId: string,
): Promise<{ seasons: SeasonConfig[]; currentSeasonNumber: number | null }> {
  const res = await apiService.request<{
    seasons: SeasonConfig[];
    currentSeasonNumber: number | null;
    success: boolean;
  }>(`/admin/seasons?adminUserId=${encodeURIComponent(adminUserId)}`, { method: 'GET' });
  return { seasons: res.seasons, currentSeasonNumber: res.currentSeasonNumber };
}

export async function addSeason(
  adminUserId: string,
  data: {
    seasonNumber: number;
    name: string;
    startDate: string;
    endDate?: string;
    status?: string;
    message?: string;
  },
): Promise<void> {
  await apiService.request('/admin/seasons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, ...data }),
  });
}

export async function updateSeason(
  adminUserId: string,
  data: {
    seasonNumber?: number;
    name?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    message?: string;
    currentSeasonNumber?: number | null;
  },
): Promise<void> {
  await apiService.request('/admin/seasons', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, ...data }),
  });
}

export async function deleteSeason(adminUserId: string, seasonNumber: number): Promise<void> {
  await apiService.request('/admin/seasons', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, seasonNumber }),
  });
}

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
  isCasinoRush?: boolean;
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
    timestamp?: string;       // preferred — exact entry identity
    factKey?: string;         // legacy fallback
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
  type: string;
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
  type: string;
  status: string;
  questions: number;
  answered: number;
  startTime: string;
}

export async function getAllStuckSessions(
  adminUserId: string,
): Promise<StuckSessionInfo[]> {
  const result = await apiService.request<{ sessions: StuckSessionInfo[] }>(
    `/admin/game-sessions?adminUserId=${encodeURIComponent(adminUserId)}`,
    { method: 'GET' },
  );
  return result.sessions;
}

export async function resetGameSession(
  adminUserId: string,
  data: { userId: string; gameType: 'casino-rush' | 'slot-machine' | 'all' },
): Promise<void> {
  await apiService.request('/admin/game-sessions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, ...data }),
  });
}

// ── Daily Questions ─────────────────────────────────────────────

export interface DailyQuestionEntry {
  key: string;
  date: string;
  question: string;
  createdBy: string;
  answered: boolean;
}

export async function getDailyQuestions(adminUserId: string): Promise<DailyQuestionEntry[]> {
  const result = await apiService.request<{ questions: DailyQuestionEntry[] }>(
    `/admin/daily-questions?adminUserId=${encodeURIComponent(adminUserId)}`,
    { method: 'GET' },
  );
  return result.questions;
}

export async function deleteDailyQuestion(adminUserId: string, date: string): Promise<void> {
  await apiService.request('/admin/daily-questions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, date }),
  });
}
