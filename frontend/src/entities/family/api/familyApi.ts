/** The family: people, ties and households (docs/decisions/0009). */
import type { Family } from '@family-trivia/shared';
import { callApi, type ResponseOf } from '../../../shared/api/contract';

/** The family, and photo key → short-lived URL to show it. */
export type FamilyResponse = ResponseOf<'/family'>;

export const familyApi = {
  /** For the avatar store; screens read the family with useFamily. */
  get: () => callApi('/family'),

  /** Admins only. The server keeps the version this replaces. */
  save: (family: Family) => callApi('/admin/family', { method: 'put', body: { family } }),
};
