/** The family: people, ties and households (docs/decisions/0009). */
import type { Family } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

export interface FamilyResponse {
  family: Family;
  /** Photo key → short-lived URL to show it. */
  photoUrls: Record<string, string>;
}

export const familyApi = {
  get: () => apiService.request<FamilyResponse>('/family', { method: 'GET' }, undefined, true),

  /** Admins only. The server keeps the version this replaces. */
  save: (family: Family) =>
    apiService.request<FamilyResponse>('/admin/family', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ family }),
    }),
};
