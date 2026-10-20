/**
 * Question Slot Service
 *
 * Single source of truth for collapsing answer history into "question slots".
 * A question slot = one playable question opportunity:
 *   - Regular trivia → 1 slot
 *   - Catch-up answer → 1 slot
 *   - A play that asks several questions (one playOf id) → 1 slot (all-or-nothing)
 *   - A game mode or round → 1 slot
 *   - Family Feud → not in history, excluded automatically
 *
 * Used by:
 *   - answerGridService (TriviaStatusBar matrix)
 *   - catchupService (catch-up benchmark)
 *   - consolidatedLeaderboard (questionsAnswered, streak)
 *   - scoring-catchup.test.ts (integration tests)
 */

import { gameModeOf, type HistoryEntry, playOf } from '@family-trivia/shared';

// ── Types ─────────────────────────────────────────────────────────

export interface QuestionSlot {
  /** Did the player get this slot correct? */
  correct: boolean;
  /** Timestamp of the slot (the first answer of a play with several) */
  timestamp: string;
  /** Was this a game mode or round slot? */
  isGameMode: boolean;
  /** Was this a catch-up answer? */
  isCatchingUp: boolean;
}

// ── Core: collapse history → slots ────────────────────────────────

/**
 * Collapse a user's full answer history into sequential question slots.
 *
 * A play that asks several questions (entries sharing a playOf id) is
 * collapsed into a single slot. The slot is "correct" only if every
 * sub-question in the session was correct (all-or-nothing).
 *
 * Output is sorted chronologically (oldest first).
 */
export function toQuestionSlots(history: HistoryEntry[]): QuestionSlot[] {
  const sorted = [...history].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const slots: QuestionSlot[] = [];
  const seenPlays = new Set<string>();

  for (const h of sorted) {
    // A play with several questions: 1 slot
    const play = playOf(h);
    if (play) {
      if (seenPlays.has(play)) continue;
      seenPlays.add(play);
      const sessionEntries = sorted.filter((e) => playOf(e) === play);
      slots.push({
        correct: sessionEntries.every((e) => e.correct),
        timestamp: h.timestamp,
        isGameMode: true,
        isCatchingUp: false,
      });
      continue;
    }

    // Any other game mode or round = 1 slot each.
    const mode = gameModeOf(h);
    slots.push({
      correct: h.correct,
      timestamp: h.timestamp,
      isGameMode: !!mode,
      isCatchingUp: !!h.isCatchingUp,
    });
  }

  return slots;
}

// ── Derived counts ────────────────────────────────────────────────

/**
 * Count "regular" question slots — excludes game modes and rounds.
 * This is the benchmark count used for catch-up calculation.
 * Optionally filters by date range (season boundaries).
 */
export function countRegularSlots(
  history: HistoryEntry[],
  startDate?: string,
  endDate?: string,
): number {
  const slots = toQuestionSlots(history);
  return slots.filter((s) => {
    if (s.isGameMode) return false;
    if (startDate) {
      const d = s.timestamp.split('T')[0];
      if (d < startDate) return false;
      if (endDate && d > endDate) return false;
    }
    return true;
  }).length;
}

/**
 * Total question slots (all modes). Matches the leaderboard's
 * questionsAnswered = regular entries + one per play.
 */
export function countAllSlots(history: HistoryEntry[]): number {
  return toQuestionSlots(history).length;
}

// ── Streak ────────────────────────────────────────────────────────

/**
 * Compute current streak: consecutive correct slots from the end of history.
 */
export function computeStreak(history: HistoryEntry[]): number {
  const slots = toQuestionSlots(history);
  let streak = 0;
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i].correct) streak++;
    else break;
  }
  return streak;
}
