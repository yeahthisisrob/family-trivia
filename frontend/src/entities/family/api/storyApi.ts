import type { PersonStory } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

/** Someone's story in their own words (GET /family/person-story). */
export const storyApi = {
  get: (personId: string) =>
    apiService.request<PersonStory>(
      `/family/person-story?personId=${encodeURIComponent(personId)}`,
      { method: 'GET' },
      `person_story_${personId}`,
    ),
};
