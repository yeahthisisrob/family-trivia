import type { FamilyKnowledge } from '@family-trivia/shared';
import { apiService } from '../../../shared/api/ApiService';

/** The family's knowledge index: themes, and each person's topics, persona and numbers. */
export const knowledgeApi = {
  get: () =>
    apiService.request<FamilyKnowledge>('/family/knowledge', { method: 'GET' }, 'family_knowledge'),
  /**
   * After an answer: read my newest answers into the index, quietly, so my
   * page and the map keep up with no button (docs/decisions/0025).
   */
  refreshMine: () => {
    apiService.request('/me/knowledge', { method: 'POST' }).catch(() => undefined);
  },
};
