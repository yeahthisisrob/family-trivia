/**
 * Player State Service — SINGLE SOURCE OF TRUTH
 *
 * ═══════════════════════════════════════════════════════════════════
 * GAME RULES
 * ═══════════════════════════════════════════════════════════════════
 * 1. Each player gets 1 daily trivia play per day.
 * 2. Game modes (Casino Rush, Slot Machine, Curling, etc.) are just
 *    different ways to play that 1 daily trivia — they all count
 *    equally as 1 slot.
 * 3. Catch-up = answering daily questions you missed on previous days.
 *    Players can answer ALL their missed days + today's daily in one
 *    session (catch-up bypasses the daily limit, gated only by gaps).
 * 4. CRITICAL: The catch-up benchmark uses slots BEFORE today. The
 *    first person to play each day must NOT make everyone else look
 *    "1 behind" — today's daily is the active day, not a gap.
 * 5. maxSeasonSlots = the leader's PRIOR-DAY slot count. catchupGaps
 *    = maxSeasonSlots - user's priorDaySlots.
 * 6. hasPlayedToday only tracks the daily play (excludes catch-up)
 *    so catch-up doesn't block the daily and vice versa.
 * 7. seasonSlots (all slots including today) is still used for
 *    leaderboard display — not for catch-up math.
 * ═══════════════════════════════════════════════════════════════════
 *
 * Consolidates all player-state computation: eligibility, catch-up,
 * leaderboard. Loads all histories ONCE per Lambda invocation
 * (in-memory cache), runs toQuestionSlots on each, and computes:
 *   - Per-player: slots, streak, score, hasPlayedToday
 *   - Cross-player: leader, maxSeasonSlots, catch-up gaps
 *
 * Uses questionSlotService for slot counting and scoring.ts for points.
 */

import { getJson, listObjects } from './s3';
import { getCurrentSeason, getSeasonsConfig, Season } from './seasonService';
import { toQuestionSlots, QuestionSlot } from './questionSlotService';
import { computePoints } from './scoring';
import { getEasternDateString, getNextMidnightET } from '@family-trivia/shared';
import { logger } from './logger';
import { HistoryEntry, PlayEligibility, PlayMode, CatchupStatus } from '@family-trivia/shared';

// ── Types ─────────────────────────────────────────────────────────

export interface PlayerState {
  userId: string;
  /** Raw history from S3 (needed by leaderboard for category/difficulty breakdowns) */
  history: HistoryEntry[];
  /** Collapsed question slots (all modes) */
  slots: QuestionSlot[];
  /** Total slots across all seasons */
  totalSlots: number;
  /** Slots in the current active season (all modes — for leaderboard display) */
  seasonSlots: number;
  /** Slots BEFORE today in the current season — used as the catch-up benchmark */
  priorDaySlots: number;
  /** Catch-up slots filed today — count toward filling prior-day gaps */
  catchupSlotsToday: number;
  /** Consecutive correct from end */
  streak: number;
  /** Total points (sum of pointsEarned via computePoints) */
  score: number;
  /** Has played their daily trivia today (any mode — regular, game mode, or catch-up) */
  hasPlayedToday: boolean;
  /** Max season slots - this player's season slots */
  catchupGaps: number;
  /** Date of last answer (YYYY-MM-DD) or null */
  lastAnswerDate: string | null;
}

export interface SeasonSummary {
  /** Active season (null if between seasons) */
  activeSeason: Season | null;
  /** All seasons sorted by startDate */
  allSeasons: Season[];
  /** Max question slots in the active season across all players */
  maxSeasonSlots: number;
  /** UserId of the season leader */
  leaderId: string | null;
  /** Whether the season has ended */
  isEndOfSeason: boolean;
}

// ── In-memory cache (per Lambda invocation) ───────────────────────

let cachedState: Map<string, PlayerState> | null = null;
let cachedSummary: SeasonSummary | null = null;

/** Clear cache — call at start of each request if needed */
export function invalidatePlayerStateCache(): void {
  cachedState = null;
  cachedSummary = null;
}

// ── Core loader ───────────────────────────────────────────────────

async function loadAllState(): Promise<{ states: Map<string, PlayerState>; summary: SeasonSummary }> {
  if (cachedState && cachedSummary) {
    return { states: cachedState, summary: cachedSummary };
  }

  const todayET = getEasternDateString();

  // Load season config + current season in parallel with histories
  const [seasonsConfig, currentSeason, historyFiles] = await Promise.all([
    getSeasonsConfig(),
    getCurrentSeason(),
    listObjects('answers/history/'),
  ]);

  const allSeasons = seasonsConfig.seasons
    .filter(s => s.startDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const activeSeason = allSeasons.find(s => s.status === 'active') ?? null;
  const seasonStart = activeSeason?.startDate ?? null;
  const seasonEnd = activeSeason?.endDate ?? null;
  const isEndOfSeason = !activeSeason || activeSeason.status !== 'active';

  // Load all histories in parallel
  const entries: { userId: string; history: HistoryEntry[] }[] = [];
  await Promise.all(
    historyFiles.map(async (key) => {
      const match = key.match(/answers\/history\/(.+)\.json$/);
      if (!match) return;
      const userId = match[1];
      try {
        const history = (await getJson<HistoryEntry[]>(key)) || [];
        entries.push({ userId, history });
      } catch (err) {
        logger.warn('Failed to load history', {
          userId, error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );

  // Compute per-player state
  const states = new Map<string, PlayerState>();
  let maxSeasonSlots = 0;
  let leaderId: string | null = null;

  // First pass: compute slots, score, streak per player
  for (const { userId, history } of entries) {
    const slots = toQuestionSlots(history);

    // Season slot counts
    const inSeason = (s: { timestamp: string }) => {
      if (!seasonStart) return true;
      const d = s.timestamp.split('T')[0];
      return d >= seasonStart && (!seasonEnd || d <= seasonEnd);
    };
    const seasonSlots = slots.filter(inSeason).length;
    // Slots strictly BEFORE today — today's daily is the active day,
    // not a "gap". Prevents the first person to play each day from
    // making everyone else look 1-behind.
    const priorDaySlots = slots.filter(s => {
      if (!inSeason(s)) return false;
      return getEasternDateString(new Date(s.timestamp)) < todayET;
    }).length;
    // Catch-up slots from today — these represent filling prior-day
    // gaps, so they count toward the catch-up benchmark.
    const catchupSlotsToday = slots.filter(s => {
      if (!inSeason(s)) return false;
      if (!s.isCatchingUp) return false;
      return getEasternDateString(new Date(s.timestamp)) === todayET;
    }).length;

    // Streak (from slots directly to avoid re-running toQuestionSlots)
    let streak = 0;
    for (let i = slots.length - 1; i >= 0; i--) {
      if (slots[i].correct) streak++;
      else break;
    }

    // Score
    let score = 0;
    for (const h of history) {
      if (h.correct) score += computePoints(h);
    }

    // Has played their daily trivia today? (catch-up doesn't count)
    const hasPlayedToday = slots.some(s =>
      !s.isCatchingUp && getEasternDateString(new Date(s.timestamp)) === todayET
    );

    // Last answer date
    const lastAnswerDate = slots.length > 0
      ? slots[slots.length - 1].timestamp.split('T')[0]
      : null;

    // Track leader using PRIOR-DAY slots only. Today's play doesn't
    // inflate the benchmark — otherwise the first person to play each
    // day makes everyone else look "1 behind". Catch-up is for missed
    // days, not for the active day.
    if (priorDaySlots > maxSeasonSlots) {
      maxSeasonSlots = priorDaySlots;
      leaderId = userId;
    }

    states.set(userId, {
      userId, history, slots, totalSlots: slots.length,
      seasonSlots, priorDaySlots, catchupSlotsToday, streak, score, hasPlayedToday,
      catchupGaps: 0, // filled after we know maxSeasonSlots
      lastAnswerDate,
    });
  }

  // Second pass: compute catch-up gaps (needs maxSeasonSlots from first pass).
  // User's "filled count" = priorDaySlots + catchup answers filed today.
  for (const state of states.values()) {
    const filled = state.priorDaySlots + state.catchupSlotsToday;
    state.catchupGaps = Math.max(0, maxSeasonSlots - filled);
  }

  const summary: SeasonSummary = {
    activeSeason, allSeasons, maxSeasonSlots, leaderId, isEndOfSeason,
  };

  // Cache for this invocation
  cachedState = states;
  cachedSummary = summary;

  logger.info('Player state loaded', {
    players: states.size,
    maxSeasonSlots,
    leaderId,
    season: activeSeason?.name ?? 'none',
  });

  return { states, summary };
}

// ── Public API ────────────────────────────────────────────────────

/** Get all player states (cached per invocation) */
export async function getAllPlayerState(): Promise<Map<string, PlayerState>> {
  const { states } = await loadAllState();
  return states;
}

/** Get a single player's state */
export async function getPlayerState(userId: string): Promise<PlayerState | null> {
  const states = await getAllPlayerState();
  return states.get(userId) ?? null;
}

/** Get season summary (leader, maxSlots, etc.) */
export async function getSeasonSummary(): Promise<SeasonSummary> {
  const { summary } = await loadAllState();
  return summary;
}

// ── Eligibility ──────────────────────────────────────────────────

/**
 * Single gate for "can this user play right now?"
 *
 * All modes share the daily limit: one play per day (regular, catch-up,
 * or game mode). Catch-up additionally requires available gaps.
 */
export async function checkPlayEligibility(
  userId: string,
  requestedMode: PlayMode,
): Promise<PlayEligibility> {
  const [state, summary] = await Promise.all([
    getPlayerState(userId),
    getSeasonSummary(),
  ]);

  const catchupAvailable = state?.catchupGaps ?? 0;
  const lastAnsweredAt = state?.slots.length
    ? state.slots[state.slots.length - 1].timestamp
    : null;
  const dailyLimitReached = state?.hasPlayedToday ?? false;

  const base = {
    todayET: summary.activeSeason ? summary.activeSeason.startDate : '',
    catchupAvailable,
    lastAnsweredAt,
  };

  // Catch-up: bypass daily limit so users can answer all missed days
  // in one session, but must have gaps remaining.
  if (requestedMode === 'catchup') {
    if (summary.isEndOfSeason) {
      return { canPlay: false, reason: 'end_of_season', nextAvailableAt: null, ...base };
    }
    if (catchupAvailable <= 0) {
      return { canPlay: false, reason: 'no_catchup_available', ...base };
    }
    return { canPlay: true, ...base };
  }

  // Non-catchup: end-of-season and daily limit apply
  if (summary.isEndOfSeason) {
    return { canPlay: false, reason: 'end_of_season', nextAvailableAt: null, ...base };
  }

  if (dailyLimitReached) {
    return {
      canPlay: false, reason: 'daily_limit_reached',
      nextAvailableAt: getNextMidnightET(), ...base,
    };
  }

  return { canPlay: true, ...base };
}

// ── Catch-up status ──────────────────────────────────────────────

/**
 * How many PRIOR-DAY questions a user is behind the leader.
 * Today's daily is not a "gap" — it's the active day.
 */
export async function calculateCatchupStatus(userId: string): Promise<CatchupStatus> {
  const [playerState, summary] = await Promise.all([
    getPlayerState(userId),
    getSeasonSummary(),
  ]);

  const userAnswerCount = playerState
    ? playerState.priorDaySlots + playerState.catchupSlotsToday
    : 0;
  const maxQuestionsAvailable = summary.maxSeasonSlots;
  const questionsBehind = Math.max(0, maxQuestionsAvailable - userAnswerCount);

  logger.info(`Catchup: ${userId} has ${userAnswerCount}/${maxQuestionsAvailable}, behind ${questionsBehind}`);

  return { questionsBehind, userAnswerCount, maxQuestionsAvailable };
}
