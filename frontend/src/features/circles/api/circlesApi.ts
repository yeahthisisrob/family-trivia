import type { Circle, CircleKind, Invite, MyCircle } from '@family-trivia/shared';
import { apiService } from '../../../shared/api/ApiService';
import type { ResponseOf } from '../../../shared/api/contract';

/** Two people from different circles who might be one (docs/decisions/0018). */
export type SameSuggestion = ResponseOf<'/admin/circles/same'>['suggestions'][number];

/** Changes to circles; the circles themselves are read in model/circles.ts. */
export const circlesApi = {
  join: (passphrase: string) =>
    apiService.request<{ circles: MyCircle[]; joined: string; userId: string }>('/me/circles', {
      method: 'POST',
      once: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    }),
  /** A link anyone can use to join that circle (the caller is an admin there). */
  invite: (circleId: string) =>
    apiService.request<{ invite: Invite }>('/admin/invites', {
      method: 'POST',
      once: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ circleId, lifetime: 'month' }),
    }),
  /** Join circles into one, or join a split one again (docs/decisions/0018). */
  joinCircles: (j: { name: string; sources: string[] }) =>
    apiService.request<{ circle: Circle; again: boolean; circles: MyCircle[] }>(
      '/admin/circles/join',
      {
        method: 'POST',
        once: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(j),
      },
    ),
  /** End a joined circle; nothing is deleted. */
  split: (circleId: string) =>
    apiService.request<{ circle: Circle; circles: MyCircle[] }>('/admin/circles/split', {
      method: 'POST',
      once: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ circleId }),
    }),
  answerSame: (circleId: string, s: SameSuggestion, same: boolean) =>
    apiService.request<{ suggestions: SameSuggestion[] }>('/admin/circles/same', {
      method: 'POST',
      once: true,
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
      once: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    }),
};
