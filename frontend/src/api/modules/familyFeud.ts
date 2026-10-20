// Module: familyFeud
// Family Feud round-robin game mode API

import { apiService } from '../../shared/api/ApiService';

export interface FamilyFeudGuesser {
  userName: string;
  submittedAt: string;
}

export interface FamilyFeudGuess {
  userName: string;
  guess: string;
  correct: boolean;
}

export interface FamilyFeudWinner {
  userId: string;
  userName: string;
  points: number;
}

export interface FamilyFeudResults {
  winners: FamilyFeudWinner[];
  totalGuesses: number;
  revealedAt: string;
}

export interface FamilyFeudRoundInfo {
  roundId: string;
  targetUserId: string;
  targetUserName: string;
  question: string;
  status: 'waiting_for_target' | 'active' | 'completed';
  startedAt: string;
  expiresAt: string;
  guessCount: number;
  /** Users who have guessed so far (for the "X people voted" display) */
  guessers: FamilyFeudGuesser[];
  myGuess: string | null;
  choices: string[] | null;
  realAnswer: string | null;
  /** All guesses with correctness — only present after completion */
  allGuesses: FamilyFeudGuess[] | null;
  results: FamilyFeudResults | null;
}

// The status Home reads is in features/family-feud (server data, 0035).

interface FamilyFeudRoundResponse {
  round: { roundId: string; question: string; status: string; expiresAt: string };
}

export async function startFamilyFeudRound(userId: string): Promise<FamilyFeudRoundResponse> {
  return apiService.request<FamilyFeudRoundResponse>(
    '/family-feud/start-round',
    { method: 'POST', body: JSON.stringify({ userId }) },
    undefined,
    false,
    30000,
  );
}

export async function submitFamilyFeudAnswer(
  userId: string,
  answer: string,
): Promise<FamilyFeudRoundResponse> {
  return apiService.request<FamilyFeudRoundResponse>('/family-feud/answer', {
    method: 'POST',
    body: JSON.stringify({ userId, answer }),
  });
}

export async function submitFamilyFeudGuess(
  userId: string,
  guess: string,
): Promise<{ guessCount: number }> {
  return apiService.request<{ guessCount: number }>('/family-feud/guess', {
    method: 'POST',
    body: JSON.stringify({ userId, guess }),
  });
}

export async function passFamilyFeudTurn(
  userId: string,
): Promise<{ passed: boolean; nextTargetUserName: string }> {
  return apiService.request<{ passed: boolean; nextTargetUserName: string }>('/family-feud/pass', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

// Admin functions — returns the full feud state for debugging
export interface AdminFamilyFeudState {
  currentRound: FamilyFeudRoundInfo | null;
  rotation: { allUserIds: string[]; currentIndex: number; roundHistory: unknown[] };
  allRounds: Array<{ roundId: string; targetUserName: string; status: string }>;
}

export async function adminGetFamilyFeud(adminUserId: string): Promise<AdminFamilyFeudState> {
  return apiService.request<AdminFamilyFeudState>(
    `/admin/family-feud?adminUserId=${encodeURIComponent(adminUserId)}`,
    { method: 'GET' },
  );
}

export async function adminResetFamilyFeud(
  adminUserId: string,
  action: 'reset-current' | 'delete-round' | 'reset-rotation',
  roundId?: string,
): Promise<void> {
  await apiService.request('/admin/family-feud', {
    method: 'DELETE',
    body: JSON.stringify({ adminUserId, action, roundId }),
  });
}
