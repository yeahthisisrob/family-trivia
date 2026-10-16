// Module: celebrations
// Birthdays, celebrations, and end-of-season

import type {
  Celebration,
  CelebrationsResponse,
  EndOfSeasonStatus,
  UpcomingBirthdaysResponse,
} from '@family-trivia/shared';
import { apiService } from '../../services/ApiService';

export type {
  Birthday,
  Celebration,
  CelebrationsResponse,
  EndOfSeasonStatus,
  Season,
  UpcomingBirthdaysResponse,
} from '@family-trivia/shared';

// ─── Birthdays & Celebrations ────────────────────────────────────────

/**
 * Get upcoming birthdays from the family
 */
export async function getUpcomingBirthdays(limit = 10): Promise<UpcomingBirthdaysResponse> {
  return apiService.request<UpcomingBirthdaysResponse>(
    `/upcoming-birthdays?limit=${limit}`,
    { method: 'GET' },
    `upcoming_birthdays_${limit}`,
    false,
  );
}

/**
 * Add a new celebration
 */
export async function addCelebration(data: {
  type: 'birthday' | 'anniversary' | 'holiday' | 'other';
  name: string;
  date: string;
  description?: string;
  addedBy: string;
  recurring?: boolean;
  year?: number;
}): Promise<{ success: boolean; celebration: Celebration }> {
  return apiService.request<{ success: boolean; celebration: Celebration }>(
    '/celebrations',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    undefined,
    true, // force refresh
  );
}

/**
 * Get all celebrations
 */
export async function getCelebrations(): Promise<CelebrationsResponse> {
  return apiService.request<CelebrationsResponse>(
    '/celebrations',
    { method: 'GET' },
    'all_celebrations',
    false,
  );
}

/**
 * Delete a celebration
 */
export async function deleteCelebration(id: string, userId: string): Promise<{ success: boolean }> {
  return apiService.request<{ success: boolean }>(
    `/celebrations?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
    undefined,
    true,
  );
}

// ─── End of Season ───────────────────────────────────────────────────

/** Remember that this person read a season letter, so it isn't shown again. */
export async function markSeasonLetterSeen(
  seasonNumber: number,
  kind: 'start' | 'end',
): Promise<void> {
  await apiService.request('/season-letters/seen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seasonNumber, kind }),
  });
}

export async function getEndOfSeasonStatus(): Promise<EndOfSeasonStatus> {
  return apiService.request<EndOfSeasonStatus>('/end-of-season-status', {
    method: 'GET',
  });
}
