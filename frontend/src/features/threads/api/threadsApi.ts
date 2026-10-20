import type { ThreadAnswer, ThreadProgress } from '@family-trivia/shared';
import { apiService } from '../../../shared/api/ApiService';

export const threadsApi = {
  answer: (a: ThreadAnswer) =>
    apiService.request<{ tied: boolean; progress: ThreadProgress }>('/threads/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(a),
    }),
};
