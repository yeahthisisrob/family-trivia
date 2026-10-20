import type { ReactableType, ReactionId, ReactionSummary } from '@family-trivia/shared';
import { apiService } from '../../../shared/api/ApiService';

export const reactionsApi = {
  get: (type: ReactableType, ids: string[]) =>
    apiService.request<{ reactions: Record<string, ReactionSummary> }>(
      `/reactions?contentType=${type}&ids=${ids.map(encodeURIComponent).join(',')}`,
      { method: 'GET' },
    ),
  set: (type: ReactableType, contentId: string, reaction: ReactionId | null) =>
    apiService.request<{ contentId: string; summary: ReactionSummary }>('/reactions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: type, contentId, reaction }),
    }),
};
