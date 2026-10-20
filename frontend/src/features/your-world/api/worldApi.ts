import type { WorldView } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

export const worldApi = {
  get: () => apiService.request<WorldView>('/me/world', { method: 'GET' }),
};
