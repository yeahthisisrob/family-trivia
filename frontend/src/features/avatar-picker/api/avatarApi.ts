import type { AvatarChoice } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

export const avatarApi = {
  save: (avatar: AvatarChoice | null) =>
    apiService.request<{ avatar: AvatarChoice | null }>('/me/avatar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar }),
    }),
};
