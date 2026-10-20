/**
 * gameAI — shared Haiku-powered strategy service for arcade games.
 *
 * Each game registers its standing instructions, a prompt for the game
 * state, the shape of its answer (a JSON schema and a check) and how to turn
 * that answer into a move. The service asks the model for the answer as data
 * (askStructured, 0033) and returns a typed move. Caller provides a fallback
 * that runs if the AI fails.
 *
 * Used by: curling (computer throws), blackjack (dealer commentary).
 * Cheap — uses Haiku, ~128 output tokens per call.
 */

import { askStructured } from './bedrock/core/converse';
import { modelFor } from './bedrock/core/models';
import { isRecord } from './bedrock/core/shape';
import { logger } from './logger';

// ── Game prompt registry ────────────────────────────────────────

export interface GameAIPrompt<TState, TAnswer, TMove> {
  /** What the model is and the rules, the same every call. */
  system: string;
  buildPrompt: (state: TState) => string;
  /** The answer's tool: its name, what it's for, its JSON schema and its check. */
  name: string;
  description: string;
  schema: Record<string, unknown>;
  check: (v: unknown) => v is TAnswer;
  parseMove: (answer: TAnswer) => TMove;
}

const MAX_TOKENS = 128;
const TEMPERATURE = 0.5;

/**
 * Ask Haiku for a game move. Returns null on any failure so the
 * caller can fall back to local logic.
 */
export async function getAIMove<TState, TAnswer, TMove>(
  game: GameAIPrompt<TState, TAnswer, TMove>,
  state: TState,
): Promise<TMove | null> {
  try {
    const answer = await askStructured({
      task: 'gameMoves',
      system: game.system,
      prompt: game.buildPrompt(state),
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      model: modelFor('gameMoves'),
      name: game.name,
      description: game.description,
      schema: game.schema,
      check: game.check,
    });
    return game.parseMove(answer);
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

interface CurlingAnswer {
  power: number;
  angle: number;
  strategy?: string;
}

/** A throw: power and angle as numbers. */
export const isCurlingAnswer = (v: unknown): v is CurlingAnswer =>
  isRecord(v) &&
  Number.isFinite(v.power) &&
  Number.isFinite(v.angle) &&
  (v.strategy === undefined || typeof v.strategy === 'string');

export const curlingAI: GameAIPrompt<CurlingState, CurlingAnswer, CurlingMove> = {
  system: `You are a curling strategy AI. Sheet: 280×460px, house center (140,120).
Rings: button r=8, 4ft r=33, 8ft r=67, 12ft r=100.
Stone launches from (140,410). Power 0-100 (60≈house center). Angle -0.15 to 0.15 radians (0=straight).

Strategies: "draw" (aim for button, power 55-68), "takeout" (hit a player stone, power 70-90), "guard" (protect your stone, power 50-62 with angle offset).`,
  name: 'throw_stone',
  description: 'The next throw: power, angle and the strategy behind it.',
  schema: {
    type: 'object',
    properties: {
      power: { type: 'number', minimum: 0, maximum: 100 },
      angle: { type: 'number', minimum: -0.15, maximum: 0.15 },
      strategy: { type: 'string', enum: ['draw', 'takeout', 'guard'] },
    },
    required: ['power', 'angle', 'strategy'],
  },
  check: isCurlingAnswer,

  buildPrompt(state) {
    const descStone = (s: CurlingState['stones'][0]) => {
      const dx = s.x - 140,
        dy = s.y - 120;
      const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
      const ring =
        dist <= 8
          ? 'button'
          : dist <= 33
            ? '4ft'
            : dist <= 67
              ? '8ft'
              : dist <= 100
                ? '12ft'
                : 'out';
      return `${s.owner}@(${Math.round(s.x)},${Math.round(s.y)}) ${ring}`;
    };

    const board =
      state.stones.length === 0 ? 'Empty sheet.' : state.stones.map(descStone).join('; ');

    return `Throw ${state.throwNum + 1}/4. Board: ${board}

Return ONLY: {"power":<num>,"angle":<num>,"strategy":"<str>"}`;
  },

  parseMove(answer) {
    return {
      power: Math.max(40, Math.min(95, answer.power || 60)),
      angle: Math.max(-0.15, Math.min(0.15, answer.angle || 0)),
      strategy: answer.strategy || 'draw',
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

export const blackjackDealerAI: GameAIPrompt<
  BlackjackState,
  BlackjackDealerResponse,
  BlackjackDealerResponse
> = {
  system:
    'You are a veteran dealer at the Borgata casino in Atlantic City. Dry wit, quick one-liners, a little sarcastic but never mean. Think of a funny friend who happens to deal cards. All English, no Spanish.',
  name: 'dealer_line',
  description: 'One short, funny dealer quip.',
  schema: {
    type: 'object',
    properties: { taunt: { type: 'string', description: 'At most 12 words' } },
    required: ['taunt'],
  },
  check: (v): v is BlackjackDealerResponse => isRecord(v) && typeof v.taunt === 'string',

  buildPrompt(state) {
    return `Player hand: ${state.playerHand.join(', ')} (total: ${state.playerTotal})
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

  parseMove(answer) {
    const taunt = answer.taunt.slice(0, 80);
    return { taunt: taunt || "Bold move. Let's see how that works out." };
  },
};
