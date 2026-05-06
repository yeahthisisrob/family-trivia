// Module: gameAI — shared Haiku-powered game strategy.
// Single endpoint, typed per-game wrappers, with timeout + fallback.

import { apiService } from '../../services/ApiService';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GameAI');

const AI_TIMEOUT_MS = 4000;

async function fetchMove<TState, TMove>(
  game: string,
  state: TState,
): Promise<TMove | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    const res = await apiService.request<{ move: TMove | null }>(
      '/game-ai/move',
      {
        method: 'POST',
        body: JSON.stringify({ game, state }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);
    return res.move;
  } catch (err) {
    logger.warn(`Game AI failed for ${game}, using fallback`, err);
    return null;
  }
}

// ── Curling ─────────────────────────────────────────────────────

export interface CurlingAIState {
  stones: Array<{ x: number; y: number; owner: 'player' | 'computer' }>;
  throwNum: number;
}

export interface CurlingAIMove {
  power: number;
  angle: number;
  strategy: string;
}

export async function getCurlingAIMove(state: CurlingAIState): Promise<CurlingAIMove | null> {
  return fetchMove<CurlingAIState, CurlingAIMove>('curling', state);
}

// ── Blackjack dealer ────────────────────────────────────────────

export interface BlackjackDealerState {
  playerHand: string[];
  dealerShowing: string;
  playerTotal: number;
  phase: 'deal' | 'hit' | 'stand' | 'bust' | 'win' | 'push';
}

export interface BlackjackDealerTaunt {
  taunt: string;
}

export async function getBlackjackTaunt(state: BlackjackDealerState): Promise<BlackjackDealerTaunt | null> {
  return fetchMove<BlackjackDealerState, BlackjackDealerTaunt>('blackjack', state);
}
