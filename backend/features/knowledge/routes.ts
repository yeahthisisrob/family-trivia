import { requireAuth } from '../../middleware/requireAuth';
import { buildKnowledge, buildMyKnowledge, getKnowledge } from './handlers';

export const knowledgeRoutes = {
  'GET /family/knowledge': requireAuth(getKnowledge),
  'POST /admin/knowledge/build': requireAuth(buildKnowledge),
  'POST /me/knowledge': requireAuth(buildMyKnowledge),
};
