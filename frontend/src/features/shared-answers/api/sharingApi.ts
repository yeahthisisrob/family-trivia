import type { CircleKind } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

/** A circle your past answers could show from, in a joined circle (docs/decisions/0018). */
export interface SharedFrom {
  circleId: string;
  name: string;
  kind: CircleKind;
  shared: boolean;
}

export const sharingApi = {
  get: () => apiService.request<{ from: SharedFrom[] }>('/me/sharing'),
  set: (circleId: string, shared: boolean) =>
    apiService.request<{ from: SharedFrom[] }>('/me/sharing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ circleId, shared }),
    }),
};
