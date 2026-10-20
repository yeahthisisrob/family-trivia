import { requireAuth } from '../../middleware/requireAuth';
import { getTeams, postAnswer, postAsk, postLeave, postTeam } from './handlers';

export const teamsRoutes = {
  'GET /teams': requireAuth(getTeams),
  'POST /teams': requireAuth(postTeam),
  'POST /teams/ask': requireAuth(postAsk),
  'POST /teams/answer': requireAuth(postAnswer),
  'POST /teams/leave': requireAuth(postLeave),
};
