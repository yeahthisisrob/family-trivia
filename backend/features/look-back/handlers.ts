/** Looking back on a season (shared/src/look-back.ts). */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { getSeasonsConfig } from '../../services/seasonService';
import { buildSeasonReview } from './review';

/** GET /seasons/review?season=N; without one, the latest season that has started. */
export async function getSeasonReview(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { seasons } = await getSeasonsConfig();
  const started = seasons.filter((s) => s.status !== 'upcoming');
  if (!started.length) return errorResponse('No seasons yet', 404);
  const asked = Number(event.queryStringParameters?.season);
  const season = Number.isFinite(asked)
    ? started.find((s) => s.seasonNumber === asked)
    : [...started].sort((a, b) => b.seasonNumber - a.seasonNumber)[0];
  if (!season) return errorResponse('Unknown season', 404);
  return successResponse(await buildSeasonReview(season, started));
}
