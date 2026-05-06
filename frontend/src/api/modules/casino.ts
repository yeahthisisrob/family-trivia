// Module: casino — shared credit pool for slots + blackjack

import { apiService } from '../../services/ApiService';

export interface CasinoBalanceResponse {
  balance: number;
  floor: number;
}

export async function getCasinoBalance(userId: string): Promise<CasinoBalanceResponse> {
  return apiService.request<CasinoBalanceResponse>(
    `/casino/balance?userId=${encodeURIComponent(userId)}`,
    { method: 'GET' },
  );
}

export async function updateCasinoBalance(
  userId: string,
  balance: number,
): Promise<CasinoBalanceResponse> {
  return apiService.request<CasinoBalanceResponse>(
    '/casino/balance',
    {
      method: 'POST',
      body: JSON.stringify({ userId, balance }),
    },
  );
}
