import type { AfterPlan, Drop, PlansView, Rsvp } from '@family-trivia/shared';
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
  after: () =>
    apiService
      .request<{ plans: AfterPlan[] }>('/plans/after', { method: 'GET' })
      .then((r) => r.plans),
  remember: (id: string, text: string) =>
    post<{ plans: AfterPlan[] }>('/plans/memory', { id, text }).then((r) => r.plans),
  skip: (id: string) =>
    post<{ plans: AfterPlan[] }>('/plans/memory', { id, skip: true }).then((r) => r.plans),
};
