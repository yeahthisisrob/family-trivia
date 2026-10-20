import { requireAuth } from '../../middleware/requireAuth';
// Plans add their moments to people's life timelines (docs/decisions/0018).
import './lifeEvents';
import { getAfter, getPlans, postPlan, postPlanMemory, postRemovePlan, postRsvp } from './handlers';

export const plansRoutes = {
  'GET /plans': requireAuth(getPlans),
  'POST /plans': requireAuth(postPlan),
  'POST /plans/remove': requireAuth(postRemovePlan),
  'POST /plans/rsvp': requireAuth(postRsvp),
  'GET /plans/after': requireAuth(getAfter),
  'POST /plans/memory': requireAuth(postPlanMemory),
};
