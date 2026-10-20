/** Games (docs/decisions/0032): scores, saves and clues, for any game by id. */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { getHighScores, submitScore } from '../../services/arcadeService';
import { clues, GAME_ID, readSave, SAVE_LIMIT, writeSave } from './service';

const body = (e: APIGatewayProxyEvent): Record<string, unknown> => {
  try {
    const b: unknown = JSON.parse(e.body || '{}');
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const gameOf = (v: unknown): string | null => (typeof v === 'string' && GAME_ID.test(v) ? v : null);

const badGame = () => errorResponse('game must be a game id like "snake" or "word-ladder"', 400);

const int = (v: string | undefined, d: number, lo: number, hi: number) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** GET /games/scores?game= */
export async function getScores(e: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const game = gameOf(e.queryStringParameters?.game);
  if (!game) return badGame();
  return successResponse({ game, scores: (await getHighScores(game)).slice(0, 20) });
}

/** POST /games/scores { game, score } — your best counts. */
export async function postScore(e: APIGatewayProxyEvent, me: string) {
  const { game: g, score } = body(e);
  const game = gameOf(g);
  if (!game) return badGame();
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0)
    return errorResponse('score must be a number, 0 or more', 400);
  return successResponse(await submitScore(game, me, Math.round(score), 'arcade'));
}

/** GET /games/save?game= */
export async function getSave(e: APIGatewayProxyEvent, me: string) {
  const game = gameOf(e.queryStringParameters?.game);
  if (!game) return badGame();
  return successResponse({ game, save: await readSave(game, me) });
}

/** PUT /games/save { game, save } */
export async function putSave(e: APIGatewayProxyEvent, me: string) {
  const { game: g, save } = body(e);
  const game = gameOf(g);
  if (!game) return badGame();
  if (save === undefined) return errorResponse('save is required', 400);
  if (JSON.stringify(save).length > SAVE_LIMIT)
    return errorResponse(`A save is at most ${SAVE_LIMIT} characters`, 413);
  await writeSave(game, me, save);
  return successResponse({ game, save });
}

/** GET /games/clues?count=&minLength=&maxLength= */
export async function getClues(e: APIGatewayProxyEvent) {
  const q = e.queryStringParameters ?? {};
  const minLength = int(q.minLength, 3, 2, 15);
  const maxLength = int(q.maxLength, 8, minLength, 15);
  return successResponse({
    clues: await clues({ count: int(q.count, 20, 1, 50), minLength, maxLength }),
  });
}
