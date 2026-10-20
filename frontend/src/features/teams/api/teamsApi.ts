import type { TeamsView } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

const post = (path: string, body: unknown = {}) =>
  apiService.request<TeamsView>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const teamsApi = {
  view: () => apiService.request<TeamsView>('/teams', { method: 'GET' }),
  start: (name: string) => post('/teams', { name }),
  join: (teamId: string) => post('/teams/ask', { teamId }),
  teamUp: (to: string) => post('/teams/ask', { to }),
  answer: (requestId: string, accept: boolean) => post('/teams/answer', { requestId, accept }),
  leave: () => post('/teams/leave'),
};
