// File: lambda/routes/gameAI.ts
// Single endpoint for all game AI moves. Dispatches to the right
// prompt template based on the `game` field in the request body.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import {
  getAIMove,
  curlingAI,
  blackjackDealerAI,
  type CurlingState,
  type BlackjackState,
} from '../services/gameAI';

/**
 * POST /game-ai/move
 * Body: { game: 'curling' | 'blackjack', state: {...} }
 * Returns: { move: {...} } or { move: null } on AI failure
 */
export async function gameAIMove(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { game, state } = body as { game?: string; state?: unknown };

    if (!game || !state) return errorResponse('Missing game or state', 400);

    let move: unknown = null;

    switch (game) {
      case 'curling':
        move = await getAIMove(curlingAI, state as CurlingState);
        break;
      case 'blackjack':
        move = await getAIMove(blackjackDealerAI, state as BlackjackState);
        break;
      default:
        return errorResponse(`Unknown game: ${game}`, 400);
    }

    return successResponse({ move });
  } catch (err) {
    logger.error('Game AI route error', { error: err instanceof Error ? err.message : String(err) });
    return successResponse({ move: null });
  }
}
