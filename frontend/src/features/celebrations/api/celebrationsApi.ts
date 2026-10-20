// The dates the family adds: POST/DELETE /celebrations. Reads are in model/useCelebrations.ts.
import type { Celebration, CelebrationType } from '@family-trivia/shared';
import { apiService } from '../../../shared/api/ApiService';

export const celebrationsApi = {
  /** Added by the signed-in person. */
  add: (data: {
    type: CelebrationType;
    name: string;
    date: string;
    description?: string;
    recurring?: boolean;
    year?: number;
  }) =>
    apiService.request<{ success: boolean; celebration: Celebration }>('/celebrations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    apiService.request<{ success: boolean }>(`/celebrations?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
