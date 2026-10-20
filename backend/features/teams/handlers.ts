/** Teams (docs/decisions/0030): see them, start one, ask, answer, leave. */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import {
  answerRequest,
  askToJoin,
  askToTeamUp,
  leaveTeam,
  startTeam,
  type TeamResult,
  viewTeams,
} from './service';

const body = (e: APIGatewayProxyEvent): Record<string, unknown> => {
  try {
    const b: unknown = JSON.parse(e.body || '{}');
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/** Done → the view after it, so the screen updates in one round trip. */
async function then(r: TeamResult, me: string): Promise<APIGatewayProxyResult> {
  return r.ok ? successResponse(await viewTeams(me)) : errorResponse(r.error, r.status);
}

/** GET /teams */
export async function getTeams(_e: APIGatewayProxyEvent, me: string) {
  return successResponse(await viewTeams(me));
}

/** POST /teams { name } */
export async function postTeam(e: APIGatewayProxyEvent, me: string) {
  const { name } = body(e);
  return typeof name === 'string'
    ? then(await startTeam(me, name), me)
    : errorResponse('name is required', 400);
}

/** POST /teams/ask { teamId } (join) or { to } (team up) */
export async function postAsk(e: APIGatewayProxyEvent, me: string) {
  const { teamId, to } = body(e);
  if (typeof teamId === 'string') return then(await askToJoin(me, teamId), me);
  if (typeof to === 'string') return then(await askToTeamUp(me, to), me);
  return errorResponse('teamId or to is required', 400);
}

/** POST /teams/answer { requestId, accept } */
export async function postAnswer(e: APIGatewayProxyEvent, me: string) {
  const { requestId, accept } = body(e);
  return typeof requestId === 'string' && typeof accept === 'boolean'
    ? then(await answerRequest(me, requestId, accept), me)
    : errorResponse('requestId and accept are required', 400);
}

/** POST /teams/leave */
export async function postLeave(_e: APIGatewayProxyEvent, me: string) {
  return then(await leaveTeam(me), me);
}
