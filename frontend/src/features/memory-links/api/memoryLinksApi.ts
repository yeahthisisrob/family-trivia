import type {
  MemoryLink,
  MemoryLinkLifetime,
  MemoryLinkPreview,
  VisitorMemory,
} from '@family-trivia/shared';
import { publicRequest } from '../../../api/modules/auth';
import { apiService } from '../../../shared/api/ApiService';

const q = encodeURIComponent;
const post = <T>(path: string, body: unknown) =>
  apiService.request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const memoryLinkUrl = (token: string) => `${window.location.origin}/remember?t=${token}`;

export const memoryLinksApi = {
  // The link page, before sign-in
  preview: (token: string) => publicRequest<MemoryLinkPreview>(`/remember?token=${q(token)}`),
  add: (token: string, m: { name: string; how?: string; text: string }) =>
    publicRequest<{ waiting: true }>('/remember', { token, ...m }),

  // In the circle
  visitors: (personId: string) =>
    apiService
      .request<{ memories: VisitorMemory[] }>(`/family/visitor-memories?personId=${q(personId)}`, {
        method: 'GET',
      })
      .then((r) => r.memories),
  links: (personId: string) =>
    apiService
      .request<{ links: MemoryLink[] }>(`/admin/memory-links?personId=${q(personId)}`, {
        method: 'GET',
      })
      .then((r) => r.links),
  make: (personId: string, lifetime: MemoryLinkLifetime) =>
    post<{ link: MemoryLink }>('/admin/memory-links', { personId, lifetime }).then((r) => r.link),
  revoke: (token: string) => post('/admin/memory-links/revoke', { token }),
  decide: (personId: string, id: string, approve: boolean) =>
    post('/admin/visitor-memories/decide', { personId, id, approve }),
};
