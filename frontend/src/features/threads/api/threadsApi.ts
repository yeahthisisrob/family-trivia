import type { ThreadAnswer, ThreadProgress, ThreadsToday } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

export const threadsApi = {
  today: () => apiService.request<ThreadsToday>('/threads/today', { method: 'GET' }),
  answer: (a: ThreadAnswer) =>
    apiService.request<{ tied: boolean; progress: ThreadProgress }>('/threads/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(a),
    }),
};
