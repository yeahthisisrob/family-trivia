import type { AfterPlan, Drop, Rsvp } from '@family-trivia/shared';
import { apiService } from '../../../shared/api/ApiService';

const post = <T>(path: string, body: unknown) =>
  apiService.request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const plansApi = {
  dropIn: (text: string) => post<{ added: Drop[] }>('/plans', { text }),
  remove: (id: string) => post('/plans/remove', { id }),
  rsvp: (id: string, answer: Rsvp | null) => post('/plans/rsvp', { id, answer }),
  remember: (id: string, text: string) =>
    post<{ plans: AfterPlan[] }>('/plans/memory', { id, text }).then((r) => r.plans),
  skip: (id: string) =>
    post<{ plans: AfterPlan[] }>('/plans/memory', { id, skip: true }).then((r) => r.plans),
};
