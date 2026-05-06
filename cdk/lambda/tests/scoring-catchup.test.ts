/**
 * Integration test: Scoring, question slot counting, and catch-up logic.
 *
 * Tests the shared questionSlotService that powers:
 *   - TriviaStatusBar answer matrix (via answerGridService)
 *   - Catch-up benchmark (via catchupService)
 *   - Leaderboard questionsAnswered count
 *
 * Rules validated:
 *   - Regular trivia = 1 question slot
 *   - Casino Rush session (3 sub-questions) = 1 slot (all-or-nothing)
 *   - Slot Machine = 1 slot
 *   - Game modes (casino/slot) excluded from catch-up benchmark
 *   - Streak = consecutive correct from end of slot history
 *
 * Runs on every build via prebuild → test:ci.
 */

import { HistoryEntry } from '@family-trivia/shared';
import { computePoints } from '../services/scoring';
import {
  toQuestionSlots,
  countRegularSlots,
  countAllSlots,
  computeStreak,
} from '../services/questionSlotService';

// ── Helpers to build test history entries ──────────────────────────

function makeEntry(overrides: Partial<HistoryEntry> & { correct: boolean }): HistoryEntry {
  return {
    question: {
      question: 'Test?',
      choices: ['A', 'B', 'C', 'D'],
      answer: 'A',
      difficulty: 'normal',
      category: 'Test',
      ...overrides.question as any,
    },
    selectedAnswer: overrides.correct ? 'A' : 'B',
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    pointsEarned: overrides.pointsEarned,
    isCatchingUp: overrides.isCatchingUp,
    isCasinoRush: overrides.isCasinoRush,
    isSlotMachine: overrides.isSlotMachine,
    casinoSessionId: overrides.casinoSessionId,
    ...overrides,
  };
}

function regular(correct: boolean, opts: Partial<HistoryEntry> = {}): HistoryEntry {
  return makeEntry({ correct, pointsEarned: correct ? 1 : 0, ...opts });
}

function catchup(correct: boolean, opts: Partial<HistoryEntry> = {}): HistoryEntry {
  return makeEntry({ correct, pointsEarned: correct ? 1 : 0, isCatchingUp: true, ...opts });
}

function casinoRush(sessionId: string, results: boolean[]): HistoryEntry[] {
  return results.map((correct, i) =>
    makeEntry({
      correct,
      pointsEarned: results.every(Boolean) ? 1 : 0,
      isCasinoRush: true,
      casinoSessionId: sessionId,
      questionNumber: i + 1,
      totalQuestions: results.length,
      timestamp: new Date(Date.now() + i * 1000).toISOString(),
    }),
  );
}

function slotMachine(correct: boolean, multiplier = 1): HistoryEntry {
  return makeEntry({
    correct,
    pointsEarned: correct ? multiplier : 0,
    isSlotMachine: true,
    question: { question: 'Slot?', choices: ['A', 'B', 'C', 'D'], answer: 'A', pointMultiplier: multiplier },
  });
}

// ── Catch-up benchmark (mirrors catchupService — ALL modes count equally) ─

function calculateCatchup(
  userHistory: HistoryEntry[],
  allHistories: Record<string, HistoryEntry[]>,
): number {
  const userCount = countAllSlots(userHistory);
  let maxCount = userCount;
  for (const h of Object.values(allHistories)) {
    const c = countAllSlots(h);
    if (c > maxCount) maxCount = c;
  }
  return Math.max(0, maxCount - userCount);
}

// ── Tests ──────────────────────────────────────────────────────────

describe('computePoints', () => {
  test('uses pointsEarned when present', () => {
    expect(computePoints(regular(true, { pointsEarned: 5 }))).toBe(5);
  });

  test('falls back to pointMultiplier', () => {
    const h = makeEntry({
      correct: true,
      pointsEarned: undefined,
      question: { question: 'Q', choices: ['A'], answer: 'A', pointMultiplier: 3 },
    });
    expect(computePoints(h)).toBe(3);
  });

  test('falls back to difficulty default', () => {
    expect(computePoints(makeEntry({
      correct: true, pointsEarned: undefined,
      question: { question: 'Q', choices: ['A'], answer: 'A', difficulty: 'easy' },
    }))).toBe(0.5);

    expect(computePoints(makeEntry({
      correct: true, pointsEarned: undefined,
      question: { question: 'Q', choices: ['A'], answer: 'A', difficulty: 'hard' },
    }))).toBe(2.0);

    expect(computePoints(makeEntry({
      correct: true, pointsEarned: undefined,
      question: { question: 'Q', choices: ['A'], answer: 'A', difficulty: 'normal' },
    }))).toBe(1.0);
  });
});

describe('toQuestionSlots (shared questionSlotService)', () => {
  test('regular trivia = 1 slot per answer', () => {
    const history = [regular(true), regular(false), regular(true)];
    const slots = toQuestionSlots(history);
    expect(slots).toHaveLength(3);
    expect(slots.map(s => s.correct)).toEqual([true, false, true]);
  });

  test('catch-up answers = 1 slot, marked as isCatchingUp', () => {
    const history = [regular(true), catchup(true), catchup(false)];
    const slots = toQuestionSlots(history);
    expect(slots).toHaveLength(3);
    expect(slots[1].isCatchingUp).toBe(true);
    expect(slots[2].isCatchingUp).toBe(true);
    expect(slots[0].isCatchingUp).toBe(false);
  });

  test('casino rush session = 1 slot (all correct → true)', () => {
    const history = [
      ...casinoRush('cr_100', [true, true, true]),
      regular(false),
    ];
    const slots = toQuestionSlots(history);
    expect(slots).toHaveLength(2);
    expect(slots[0].correct).toBe(true);
    expect(slots[0].isGameMode).toBe(true);
    expect(slots[1].correct).toBe(false);
  });

  test('casino rush session = 1 slot (any wrong → false)', () => {
    const slots = toQuestionSlots(casinoRush('cr_200', [true, false, true]));
    expect(slots).toHaveLength(1);
    expect(slots[0].correct).toBe(false);
  });

  test('slot machine = 1 slot, marked as game mode', () => {
    const slots = toQuestionSlots([slotMachine(true, 3), slotMachine(false)]);
    expect(slots).toHaveLength(2);
    expect(slots[0].isGameMode).toBe(true);
    expect(slots.map(s => s.correct)).toEqual([true, false]);
  });

  test('mixed modes count correctly', () => {
    const history = [
      regular(true),
      ...casinoRush('cr_300', [true, true, true]),
      catchup(false),
      slotMachine(true, 2),
      regular(true),
    ];
    const slots = toQuestionSlots(history);
    // 1 regular + 1 casino session + 1 catchup + 1 slot machine + 1 regular = 5
    expect(slots).toHaveLength(5);
    expect(slots.map(s => s.correct)).toEqual([true, true, false, true, true]);
  });
});

describe('countRegularSlots (excludes game modes — used for stats, not catch-up)', () => {
  test('excludes casino rush from count', () => {
    const history = [
      regular(true), regular(true),
      ...casinoRush('cr_1', [true, true, true]),
    ];
    // Only 2 regular, casino rush excluded
    expect(countRegularSlots(history)).toBe(2);
  });

  test('excludes slot machine from count', () => {
    const history = [regular(true), regular(true), slotMachine(true, 5)];
    expect(countRegularSlots(history)).toBe(2);
  });

  test('includes catch-up answers in count', () => {
    const history = [regular(true), catchup(true), catchup(false)];
    expect(countRegularSlots(history)).toBe(3);
  });

  test('date range filtering works', () => {
    const history = [
      regular(true, { timestamp: '2025-06-01T12:00:00Z' }),
      regular(true, { timestamp: '2026-03-28T12:00:00Z' }),
      regular(false, { timestamp: '2026-04-01T12:00:00Z' }),
    ];
    // Only season 2 (from 2026-03-26)
    expect(countRegularSlots(history, '2026-03-26')).toBe(2);
    // Full range
    expect(countRegularSlots(history)).toBe(3);
  });
});

describe('countAllSlots (leaderboard questionsAnswered)', () => {
  test('counts all modes including game modes', () => {
    const history = [
      regular(true),
      catchup(false),
      ...casinoRush('cr_a', [true, true, true]),
      slotMachine(true, 2),
    ];
    // 1 regular + 1 catchup + 1 casino session + 1 slot = 4
    expect(countAllSlots(history)).toBe(4);
  });

  test('matches leaderboard effectiveQuestionsAnswered formula', () => {
    const history = [
      regular(true), regular(false), catchup(true),
      ...casinoRush('cr_a', [true, true, true]),
      ...casinoRush('cr_b', [true, false, true]),
      slotMachine(true, 2),
    ];

    // countAllSlots should equal regularEntries.length + casinoSessions.size
    const regularEntries = history.filter(h => !h.isCasinoRush);
    const casinoSessions = new Set(
      history.filter(h => h.isCasinoRush && h.casinoSessionId).map(h => h.casinoSessionId),
    );
    const leaderboardCount = regularEntries.length + casinoSessions.size;

    expect(countAllSlots(history)).toBe(leaderboardCount);
  });
});

describe('computeStreak', () => {
  test('counts consecutive correct from end', () => {
    expect(computeStreak([regular(false), regular(true), regular(true)])).toBe(2);
  });

  test('breaks on wrong answer', () => {
    expect(computeStreak([regular(true), regular(false), regular(true)])).toBe(1);
  });

  test('full streak', () => {
    expect(computeStreak([regular(true), regular(true), regular(true)])).toBe(3);
  });

  test('no streak when last is wrong', () => {
    expect(computeStreak([regular(true), regular(true), regular(false)])).toBe(0);
  });

  test('casino rush session treated as single unit', () => {
    const history = [
      regular(true),
      ...casinoRush('cr_1', [true, true, true]), // all correct = 1 correct slot
      regular(true),
    ];
    expect(computeStreak(history)).toBe(3); // regular + casino + regular
  });

  test('casino rush wrong breaks streak', () => {
    const history = [
      regular(true),
      ...casinoRush('cr_1', [true, false, true]), // any wrong = 1 wrong slot
      regular(true),
    ];
    expect(computeStreak(history)).toBe(1); // only the last regular
  });

  test('empty history = 0', () => {
    expect(computeStreak([])).toBe(0);
  });
});

describe('Catch-up calculation (all modes count equally)', () => {
  test('user behind leader by total slot count', () => {
    const leader = [regular(true), regular(true), regular(false), regular(true)];
    const behind = [regular(true), regular(false)];
    expect(calculateCatchup(behind, { leader, behind })).toBe(2);
  });

  test('casino rush session counts as 1 toward benchmark', () => {
    const leader = [
      regular(true), regular(true),
      ...casinoRush('cr_1', [true, true, true]),  // = 1 slot
    ];
    const behind = [regular(true)];
    // leader has 3 slots (2 regular + 1 casino), behind has 1
    expect(calculateCatchup(behind, { leader, behind })).toBe(2);
  });

  test('slot machine counts as 1 toward benchmark', () => {
    const leader = [regular(true), regular(true), slotMachine(true, 5)];
    const behind = [regular(true)];
    // leader has 3 slots, behind has 1
    expect(calculateCatchup(behind, { leader, behind })).toBe(2);
  });

  test('catch-up answers reduce the gap', () => {
    const leader = [regular(true), regular(true), regular(true)];
    const user = [regular(true), catchup(true)];
    expect(calculateCatchup(user, { leader, user })).toBe(1);
  });

  test('user caught up = 0 gap', () => {
    const a = [regular(true), regular(true), regular(true)];
    const b = [regular(true), regular(false), regular(true)];
    expect(calculateCatchup(a, { a, b })).toBe(0);
    expect(calculateCatchup(b, { a, b })).toBe(0);
  });

  test('all modes count: mixed leader vs regular-only player', () => {
    const playerA = [
      regular(true), regular(true),
      ...casinoRush('cr_x', [true, true, true]),  // 1 slot
      slotMachine(true, 5),                         // 1 slot
    ];
    // playerA has 4 slots total
    const playerB = [regular(true)];
    expect(calculateCatchup(playerB, { playerA, playerB })).toBe(3);
  });
});
