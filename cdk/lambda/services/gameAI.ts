/**
 * gameAI — shared Haiku-powered strategy service for arcade games.
 *
 * Each game registers a prompt template + response parser. The service
 * sends the game state to Haiku, parses the response, and returns a
 * typed move. Caller provides a fallback that runs if the AI fails.
 *
 * Used by: curling (computer throws), blackjack (dealer commentary).
 * Cheap — uses Haiku, ~128 output tokens per call.
 */

import { AVAILABLE_MODELS } from '../config';
import { logger } from './logger';
import { invokeBedrockPrompt } from './bedrock/core/bedrockClient';
import { collectResponseBody, extractJsonFromResponse } from './bedrock/core/responseParser';

// ── Game prompt registry ────────────────────────────────────────

export interface GameAIPrompt<TState, TMove> {
  buildPrompt: (state: TState) => string;
  parseMove: (raw: Record<string, unknown>) => TMove;
}

const MODEL = AVAILABLE_MODELS.CLAUDE_HAIKU_4_5;
const MAX_TOKENS = 128;
const TEMPERATURE = 0.5;

/**
 * Ask Haiku for a game move. Returns null on any failure so the
 * caller can fall back to local logic.
 */
export async function getAIMove<TState, TMove>(
  game: GameAIPrompt<TState, TMove>,
  state: TState,
): Promise<TMove | null> {
  try {
    const prompt = game.buildPrompt(state);
    const stream = await invokeBedrockPrompt(prompt, MAX_TOKENS, TEMPERATURE, {}, MODEL);
    const buf = await collectResponseBody(stream);
    const raw = extractJsonFromResponse(buf, MODEL);
    return game.parseMove(raw);
  } catch (err) {
    logger.warn('Game AI move failed, caller should use fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Curling ─────────────────────────────────────────────────────

export interface CurlingState {
  stones: Array<{ x: number; y: number; owner: 'player' | 'computer' }>;
  throwNum: number;
}

export interface CurlingMove {
  power: number;
  angle: number;
  strategy: string;
}

export const curlingAI: GameAIPrompt<CurlingState, CurlingMove> = {
  buildPrompt(state) {
    const descStone = (s: CurlingState['stones'][0]) => {
      const dx = s.x - 140, dy = s.y - 120;
      const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
      const ring = dist <= 8 ? 'button' : dist <= 33 ? '4ft' : dist <= 67 ? '8ft' : dist <= 100 ? '12ft' : 'out';
      return `${s.owner}@(${Math.round(s.x)},${Math.round(s.y)}) ${ring}`;
    };

    const board = state.stones.length === 0
      ? 'Empty sheet.'
      : state.stones.map(descStone).join('; ');

    return `You are a curling strategy AI. Sheet: 280×460px, house center (140,120).
Rings: button r=8, 4ft r=33, 8ft r=67, 12ft r=100.
Stone launches from (140,410). Power 0-100 (60≈house center). Angle -0.15 to 0.15 radians (0=straight).

Strategies: "draw" (aim for button, power 55-68), "takeout" (hit a player stone, power 70-90), "guard" (protect your stone, power 50-62 with angle offset).

Throw ${state.throwNum + 1}/4. Board: ${board}

Return ONLY: {"power":<num>,"angle":<num>,"strategy":"<str>"}`;
  },

  parseMove(raw) {
    return {
      power: Math.max(40, Math.min(95, Number(raw.power) || 60)),
      angle: Math.max(-0.15, Math.min(0.15, Number(raw.angle) || 0)),
      strategy: String(raw.strategy || 'draw'),
    };
  },
};

// ── Blackjack dealer ────────────────────────────────────────────

export interface BlackjackState {
  playerHand: string[];
  dealerShowing: string;
  playerTotal: number;
  phase: 'deal' | 'hit' | 'stand' | 'bust' | 'win' | 'push';
}

export interface BlackjackDealerResponse {
  taunt: string;
}

export const blackjackDealerAI: GameAIPrompt<BlackjackState, BlackjackDealerResponse> = {
  buildPrompt(state) {
    return `You are a veteran dealer at the Borgata casino in Atlantic City. Dry wit, quick one-liners, a little sarcastic but never mean. Think of a funny friend who happens to deal cards. All English, no Spanish.

Player hand: ${state.playerHand.join(', ')} (total: ${state.playerTotal})
Dealer showing: ${state.dealerShowing}
Phase: ${state.phase}

Give ONE short funny dealer quip (max 12 words). Match the energy:
- deal: something to hype them up or tease what's coming
- hit: react to the new card, build suspense
- stand: respect the gutsy call or tease
- bust: roast them gently, be funny not cruel
- win: begrudgingly impressed
- push: deadpan about the anticlimactic tie

Return ONLY: {"taunt":"<your line>"}`;
  },

  parseMove(raw) {
    const taunt = String(raw.taunt || '').slice(0, 80);
    return { taunt: taunt || 'Bold move. Let\'s see how that works out.' };
  },
};
