import type { AvatarChoice } from '@family-trivia/shared';
import { apiService } from '../../../shared/api/ApiService';

const send = <T>(path: string, method: string, body: unknown) =>
  apiService.request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export interface MadePicture {
  key: string;
  url: string;
  /** How many more can be made today. */
  left: number;
}

export const avatarApi = {
  save: (avatar: AvatarChoice | null) =>
    send<{ avatar: AvatarChoice | null }>('/me/avatar', 'PUT', { avatar }),
  make: (hint?: string) => send<MadePicture>('/me/avatar/make', 'POST', hint ? { hint } : {}),
};
