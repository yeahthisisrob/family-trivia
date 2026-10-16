import type { FamilyKnowledge } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

export interface FamilyStory {
  markdown: string | null;
  generatedAt: string | null;
  stats: {
    people: number;
    playing: number;
    households: number;
    answers: number;
    since: string | null;
  };
}

export interface Words {
  personId: string;
  words: { question: string; answer: string; date: string | null }[];
}

export const familyHomeApi = {
  story: () => apiService.request<FamilyStory>('/family/story', { method: 'GET' }, 'family_story'),
  writeStory: () => apiService.request<FamilyStory>('/admin/family/story', { method: 'POST' }),
  words: (personId: string) =>
    apiService.request<Words>(
      `/family/words?personId=${encodeURIComponent(personId)}`,
      { method: 'GET' },
      `words_${personId}`,
    ),
  knowledge: () =>
    apiService.request<FamilyKnowledge>('/family/knowledge', { method: 'GET' }, 'family_knowledge'),
  buildKnowledge: () =>
    apiService.request<{ read: number; personas: number; left: number; failures: string[] }>(
      '/admin/knowledge/build',
      { method: 'POST' },
    ),
};
