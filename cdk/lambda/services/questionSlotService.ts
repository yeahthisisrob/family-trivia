/**
 * Question Slot Service
 *
 * Single source of truth for collapsing answer history into "question slots".
 * A question slot = one playable question opportunity:
 *   - Regular trivia → 1 slot
 *   - Catch-up answer → 1 slot
 *   - Casino Rush session (3 sub-questions) → 1 slot (all-or-nothing)
 *   - Slot Machine game → 1 slot
 *   - Family Feud → not in history, excluded automatically
 *
 * Used by:
 *   - answerGridService (TriviaStatusBar matrix)
 *   - catchupService (catch-up benchmark)
 *   - consolidatedLeaderboard (questionsAnswered, streak)
 *   - scoring-catchup.test.ts (integration tests)
 */

import { HistoryEntry, gameModeOfEntry } from '@family-trivia/shared';

// ── Types ─────────────────────────────────────────────────────────

export interface QuestionSlot {
  /** Did the player get this slot correct? */
  correct: boolean;
  /** Timestamp of the slot (first entry for casino rush sessions) */
  timestamp: string;
  /** Was this a game mode slot? (casino rush or slot machine) */
  isGameMode: boolean;
  /** Was this a catch-up answer? */
  isCatchingUp: boolean;
}

// ── Core: collapse history → slots ────────────────────────────────

/**
 * Collapse a user's full answer history into sequential question slots.
 *
 * Casino Rush sessions (multiple entries sharing a casinoSessionId) are
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
  const seenCasinoSessions = new Set<string>();

  for (const h of sorted) {
    // Casino Rush: 1 slot per session
    if (h.isCasinoRush && h.casinoSessionId) {
      if (seenCasinoSessions.has(h.casinoSessionId)) continue;
      seenCasinoSessions.add(h.casinoSessionId);
      const sessionEntries = sorted.filter(
        e => e.isCasinoRush && e.casinoSessionId === h.casinoSessionId,
      );
      slots.push({
        correct: sessionEntries.every(e => e.correct),
        timestamp: h.timestamp,
        isGameMode: true,
        isCatchingUp: false,
      });
      continue;
    }

    // Game mode detection via the shared registry (casino rush is handled
    // above with its session grouping). Any other game mode = 1 slot each.
    const mode = gameModeOfEntry(h);
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
 * Count "regular" question slots — excludes game modes (casino rush, slot machine).
 * This is the benchmark count used for catch-up calculation.
 * Optionally filters by date range (season boundaries).
 */
export function countRegularSlots(
  history: HistoryEntry[],
  startDate?: string,
  endDate?: string,
): number {
  const slots = toQuestionSlots(history);
  return slots.filter(s => {
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
 * questionsAnswered = regularEntries.length + casinoSessions.size.
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
