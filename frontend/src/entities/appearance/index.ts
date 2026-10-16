/** The family's default theme (backend/features/appearance). */
import { apiService } from '../../services/ApiService';

export const appearanceApi = {
  get: () =>
    apiService.request<{ themeId: string | null }>(
      '/appearance',
      { method: 'GET' },
      undefined,
      true,
    ),
  setFamilyTheme: (themeId: string | null) =>
    apiService.request<{ themeId: string | null }>('/admin/appearance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId }),
    }),
};
