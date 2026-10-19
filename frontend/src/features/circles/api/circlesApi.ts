import type { MyCircle } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

export const circlesApi = {
  mine: () => apiService.request<{ circles: MyCircle[]; current: string }>('/me/circles'),
  join: (passphrase: string) =>
    apiService.request<{ circles: MyCircle[]; joined: string; userId: string }>('/me/circles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    }),
};
