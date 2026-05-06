/**
 * Game Mode Service — shared cooldown + history logic for all game modes.
 *
 * Reads from the single source of truth: the answer history file. Each
 * game mode marks its entries with an `isX` flag (see shared/game-modes.ts).
 *
 * Keeps per-game-mode route handlers focused on their unique gameplay —
 * cooldown math, eligibility, and history writes live here.
 */

import { HistoryEntry, GAME_MODES, GameModeId, PlayMode, getGameMode } from '@family-trivia/shared';
import { getJson } from './s3';
import { S3_PATHS } from '../constants';
import { logger } from './logger';
import { checkPlayEligibility } from './playerStateService';

// Per-invocation cache — cleared by invalidateGameModeCache() at the start
// of each Lambda request (same pattern as playerStateService).
const historyCache = new Map<string, HistoryEntry[]>();

export function invalidateGameModeCache() {
  historyCache.clear();
}

async function getCachedHistory(userId: string): Promise<HistoryEntry[]> {
  if (historyCache.has(userId)) return historyCache.get(userId)!;
  const history = (await getJson<HistoryEntry[]>(S3_PATHS.ANSWER_HISTORY(userId))) || [];
  historyCache.set(userId, history);
  return history;
}

export interface CooldownStatus {
  canPlay: boolean;
  /** When the cooldown lifts (ISO) — null if can play now */
  nextAvailable: Date | null;
  /** When the user last played this mode (ISO) — null if never played */
  lastPlayedAt: Date | null;
}

/**
 * Find the most recent history entry marked with a given game mode's flag.
 */
export async function getLastGameModeEntry(
  userId: string,
  modeId: GameModeId,
): Promise<HistoryEntry | null> {
  const config = getGameMode(modeId);
  if (!config) return null;

  try {
    const history = await getCachedHistory(userId);
    const flag = config.historyFlag;
    const entries = history.filter(h => !!(h as any)[flag]);
    if (entries.length === 0) return null;
    // Most recent by timestamp (ISO strings sort correctly)
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return entries[0];
  } catch (err) {
    logger.warn('Failed to read history for game mode cooldown', {
      userId, modeId, error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Compute weekly cooldown status for a game mode from the answer history.
 * Uses the mode's configured cooldownMs.
 */
export async function getGameModeCooldown(
  userId: string,
  modeId: GameModeId,
): Promise<CooldownStatus> {
  const config = getGameMode(modeId);
  if (!config) {
    return { canPlay: false, nextAvailable: null, lastPlayedAt: null };
  }

  const last = await getLastGameModeEntry(userId, modeId);
  if (!last) {
    return { canPlay: true, nextAvailable: null, lastPlayedAt: null };
  }

  const lastAt = new Date(last.timestamp);
  const nextAt = new Date(lastAt.getTime() + config.cooldownMs);
  const now = Date.now();

  return {
    canPlay: now >= nextAt.getTime(),
    nextAvailable: now >= nextAt.getTime() ? null : nextAt,
    lastPlayedAt: lastAt,
  };
}

/**
 * Check cooldowns for ALL game modes at once (for app-init hydration).
 */
export async function getAllGameModeCooldowns(
  userId: string,
): Promise<Record<GameModeId, CooldownStatus>> {
  const results = await Promise.all(
    GAME_MODES.map(async m => [m.id, await getGameModeCooldown(userId, m.id)] as const),
  );
  return Object.fromEntries(results) as Record<GameModeId, CooldownStatus>;
}

/**
 * "Can I play this game mode right now?" — combines the weekly cooldown
 * with the user's eligibility for the given PlayMode. The mode is playable
 * only if BOTH:
 *   - its own weekly cooldown has elapsed, AND
 *   - the user is eligible for `playMode` (which defaults to the game mode
 *     itself — pass 'catchup' to play the game mode using a catchup slot).
 */
export async function canPlayGameMode(
  userId: string,
  modeId: GameModeId,
  playMode: PlayMode = modeId,
): Promise<{ canPlay: boolean; nextAvailable: Date | null; blockedReason?: string }> {
  const [cooldown, eligibility] = await Promise.all([
    getGameModeCooldown(userId, modeId),
    checkPlayEligibility(userId, playMode),
  ]);

  if (!cooldown.canPlay) {
    return { canPlay: false, nextAvailable: cooldown.nextAvailable, blockedReason: 'cooldown' };
  }
  if (!eligibility.canPlay) {
    const next = (eligibility as any).nextAvailableAt
      ? new Date((eligibility as any).nextAvailableAt) : null;
    return { canPlay: false, nextAvailable: next, blockedReason: (eligibility as any).reason };
  }
  return { canPlay: true, nextAvailable: null };
}

/**
 * "Is this game mode available right now, regardless of how?" — returns
 * true if the user can play either as a regular daily or as a catchup.
 * Use this for UI status (tile locked/unlocked); use canPlayGameMode with
 * an explicit PlayMode when actually committing the play.
 */
export async function canPlayGameModeAny(
  userId: string,
  modeId: GameModeId,
): Promise<{ canPlay: boolean; nextAvailable: Date | null; blockedReason?: string }> {
  const [regular, catchup] = await Promise.all([
    canPlayGameMode(userId, modeId, modeId),
    canPlayGameMode(userId, modeId, 'catchup'),
  ]);
  if (regular.canPlay || catchup.canPlay) {
    return { canPlay: true, nextAvailable: null };
  }
  // Both blocked — surface whichever has a real reason. Cooldown trumps
  // daily-limit because cooldown is the harder gate (waiting days, not hours).
  if (regular.blockedReason === 'cooldown' || catchup.blockedReason === 'cooldown') {
    const r = regular.blockedReason === 'cooldown' ? regular : catchup;
    return { canPlay: false, nextAvailable: r.nextAvailable, blockedReason: 'cooldown' };
  }
  return { canPlay: false, nextAvailable: regular.nextAvailable, blockedReason: regular.blockedReason };
}
