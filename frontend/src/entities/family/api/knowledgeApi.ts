import { apiService } from '../../../shared/api/ApiService';

/** The family's knowledge index; screens read it with useKnowledge. */
export const knowledgeApi = {
  /**
   * After an answer: read my newest answers into the index, quietly, so my
   * page and the map keep up with no button (docs/decisions/0025).
   */
  refreshMine: () => {
    apiService.request('/me/knowledge', { method: 'POST' }).catch(() => undefined);
  },
};
