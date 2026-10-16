import type { FillInView } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

export const fillInApi = {
  view: () => apiService.request<FillInView>('/fill-in', { method: 'GET' }),
  save: (key: string, answer: string) =>
    apiService.request<{ key: string; fact: string }>('/fill-in', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, answer }),
    }),
};
