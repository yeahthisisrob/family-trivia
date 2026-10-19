import type { Circle, CircleKind, MyCircle } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

export const circlesApi = {
  mine: () => apiService.request<{ circles: MyCircle[]; current: string }>('/me/circles'),
  join: (passphrase: string) =>
    apiService.request<{ circles: MyCircle[]; joined: string; userId: string }>('/me/circles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    }),
  /** Every circle, for the owner (an admin of the founding circle). */
  all: () => apiService.request<{ owner: boolean; circles: Circle[] }>('/admin/circles'),
  create: (c: { name: string; kind: CircleKind; themeId: string; yourName: string }) =>
    apiService.request<{ circle: Circle; circles: MyCircle[] }>('/admin/circles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    }),
};
