import type { Circle, CircleKind, Invite, MyCircle } from '@family-trivia/shared';

interface PersonIn {
  circleId: string;
  id: string;
}
/** Two people from different circles who might be one (docs/decisions/0018). */
export interface SameSuggestion {
  a: PersonIn & { name: string; circleName: string };
  b: PersonIn & { name: string; circleName: string };
}

import { apiService } from '../../../shared/api/ApiService';

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
  /** A link anyone can use to join that circle (the caller is an admin there). */
  invite: (circleId: string) =>
    apiService.request<{ invite: Invite }>('/admin/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ circleId, lifetime: 'month' }),
    }),
  /** Join circles into one, or join a split one again (docs/decisions/0018). */
  joinCircles: (j: { name: string; sources: string[] }) =>
    apiService.request<{ circle: Circle; again: boolean; circles: MyCircle[] }>(
      '/admin/circles/join',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(j),
      },
    ),
  /** End a joined circle; nothing is deleted. */
  split: (circleId: string) =>
    apiService.request<{ circle: Circle; circles: MyCircle[] }>('/admin/circles/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ circleId }),
    }),
  /** In a joined circle: who might be the same person. */
  same: (circleId: string) =>
    apiService.request<{ suggestions: SameSuggestion[] }>(
      `/admin/circles/same?circleId=${encodeURIComponent(circleId)}`,
    ),
  answerSame: (circleId: string, s: SameSuggestion, same: boolean) =>
    apiService.request<{ suggestions: SameSuggestion[] }>('/admin/circles/same', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        circleId,
        a: { circleId: s.a.circleId, id: s.a.id },
        b: { circleId: s.b.circleId, id: s.b.id },
        same,
      }),
    }),
  create: (c: { name: string; kind: CircleKind; themeId: string; yourName: string }) =>
    apiService.request<{ circle: Circle; circles: MyCircle[] }>('/admin/circles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    }),
};
