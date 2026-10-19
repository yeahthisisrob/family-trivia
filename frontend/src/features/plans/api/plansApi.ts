import type { Drop, PlansView, Rsvp } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

const post = <T>(path: string, body: unknown) =>
  apiService.request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const plansApi = {
  view: () => apiService.request<PlansView>('/plans', { method: 'GET' }),
  dropIn: (text: string) => post<{ added: Drop[] }>('/plans', { text }),
  remove: (id: string) => post('/plans/remove', { id }),
  rsvp: (id: string, answer: Rsvp | null) => post('/plans/rsvp', { id, answer }),
};
