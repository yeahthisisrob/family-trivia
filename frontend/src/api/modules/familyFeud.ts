// Module: familyFeud
// Family Feud round-robin game mode API

import { apiService } from '../../shared/api/ApiService';

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
