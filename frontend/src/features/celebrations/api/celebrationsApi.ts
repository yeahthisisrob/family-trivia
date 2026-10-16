// Birthdays and the dates the family adds: GET /upcoming-birthdays, GET/POST/DELETE /celebrations.
import type {
  Celebration,
  CelebrationsResponse,
  CelebrationType,
  UpcomingBirthdaysResponse,
} from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

export const celebrationsApi = {
  upcoming: (limit = 10) =>
    apiService.request<UpcomingBirthdaysResponse>(
      `/upcoming-birthdays?limit=${limit}`,
      { method: 'GET' },
      `upcoming_birthdays_${limit}`,
    ),
  all: () =>
    apiService.request<CelebrationsResponse>(
      '/celebrations',
      { method: 'GET' },
      'all_celebrations',
    ),
  /** Added by the signed-in person. */
  add: (data: {
    type: CelebrationType;
    name: string;
    date: string;
    description?: string;
    recurring?: boolean;
    year?: number;
  }) =>
    apiService.request<{ success: boolean; celebration: Celebration }>(
      '/celebrations',
      { method: 'POST', body: JSON.stringify(data) },
      undefined,
      true,
    ),
  remove: (id: string) =>
    apiService.request<{ success: boolean }>(
      `/celebrations?id=${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      undefined,
      true,
    ),
};
