import type { FamilyKnowledge } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

/** The family's knowledge index: themes, and each person's topics, persona and numbers. */
export const knowledgeApi = {
  get: () =>
    apiService.request<FamilyKnowledge>('/family/knowledge', { method: 'GET' }, 'family_knowledge'),
};
