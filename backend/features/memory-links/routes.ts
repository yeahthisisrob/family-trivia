import { requireAuth } from '../../middleware/requireAuth';
import {
  getMemoryLinks,
  getRemember,
  getVisitorMemories,
  postDecideMemory,
  postMemoryLink,
  postRemember,
  postRevokeMemoryLink,
} from './handlers';

export const memoryLinksRoutes = {
  // Before sign-in: the token in the link is the secret.
  'GET /remember': getRemember,
  'POST /remember': postRemember,
  'GET /family/visitor-memories': requireAuth(getVisitorMemories),
  'GET /admin/memory-links': requireAuth(getMemoryLinks),
  'POST /admin/memory-links': requireAuth(postMemoryLink),
  'POST /admin/memory-links/revoke': requireAuth(postRevokeMemoryLink),
  'POST /admin/visitor-memories/decide': requireAuth(postDecideMemory),
};
