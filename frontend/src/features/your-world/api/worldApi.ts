import type { WorldView } from '@family-trivia/shared';
import { apiService } from '../../../shared/api/ApiService';

export const worldApi = {
  get: () => apiService.request<WorldView>('/me/world', { method: 'GET' }),
};
