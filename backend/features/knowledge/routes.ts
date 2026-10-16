import { requireAuth } from '../../middleware/requireAuth';
import { buildKnowledge, getKnowledge } from './handlers';

export const knowledgeRoutes = {
  'GET /family/knowledge': requireAuth(getKnowledge),
  'POST /admin/knowledge/build': requireAuth(buildKnowledge),
};
