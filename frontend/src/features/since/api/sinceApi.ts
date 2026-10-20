import type { SinceSummary } from '@family-trivia/shared';
import { apiService } from '../../../shared/api/ApiService';

/** What's new since I was last here; also notes that I'm here now. */
export const sinceApi = {
  check: () => apiService.request<SinceSummary>('/me/since', { method: 'POST' }),
};
