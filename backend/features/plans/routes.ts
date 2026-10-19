import { requireAuth } from '../../middleware/requireAuth';
import { getPlans, postPlan, postRemovePlan, postRsvp } from './handlers';

export const plansRoutes = {
  'GET /plans': requireAuth(getPlans),
  'POST /plans': requireAuth(postPlan),
  'POST /plans/remove': requireAuth(postRemovePlan),
  'POST /plans/rsvp': requireAuth(postRsvp),
};
