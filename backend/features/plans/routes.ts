import { requireAuth } from '../../middleware/requireAuth';
// Plans add their moments to people's life timelines (docs/decisions/0018),
// and say who may read an event's comments (0036).
import './lifeEvents';
import './commentAccess';
import { getAudience, getEvent, getEventIcs, postEvent, putEvent } from './eventHandlers';
import { getAfter, getPlans, postPlan, postPlanMemory, postRemovePlan, postRsvp } from './handlers';

export const plansRoutes = {
  'GET /plans': requireAuth(getPlans),
  'POST /plans': requireAuth(postPlan),
  'POST /plans/remove': requireAuth(postRemovePlan),
  'POST /plans/rsvp': requireAuth(postRsvp),
  'GET /plans/after': requireAuth(getAfter),
  'POST /plans/memory': requireAuth(postPlanMemory),
  'GET /plans/events': requireAuth(getEvent),
  'POST /plans/events': requireAuth(postEvent),
  'PUT /plans/events': requireAuth(putEvent),
  'GET /plans/events/audience': requireAuth(getAudience),
  'GET /plans/events/ics': requireAuth(getEventIcs),
};
