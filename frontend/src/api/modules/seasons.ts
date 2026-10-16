// Module: seasons: where the season stands, and the letters people have read.

import type { EndOfSeasonStatus } from '@family-trivia/shared';
import { apiService } from '../../services/ApiService';

export type { EndOfSeasonStatus, Season } from '@family-trivia/shared';

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
