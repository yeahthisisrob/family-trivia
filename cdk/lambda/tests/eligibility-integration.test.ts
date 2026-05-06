/**
 * Integration tests for trivia eligibility enforcement.
 *
 * Exercises the real Lambda handlers end-to-end against an in-memory S3 mock,
 * asserting that users cannot answer more questions than they should.
 *
 * These tests exist because players were answering MORE than allowed — no
 * route-level tests existed before this.
 */

// Mock S3 BEFORE importing anything that uses it
jest.mock('../services/s3', () => require('./helpers/s3Mock').s3MockModule);
// Avoid Bedrock calls during tests — generateQuestion internals import these
jest.mock('../services/bedrock/questions/trivia', () => ({ generateQuestion: jest.fn() }));
jest.mock('../services/questionPipeline', () => ({ generateBestQuestion: jest.fn() }));

import type { HistoryEntry, PlayEligibility } from '@family-trivia/shared';
import {
  resetS3Mock,
  seedHistory,
  seedDefaultActiveSeason,
  seedEndedSeason,
  getHistory,
} from './helpers/s3Mock';
import { invalidatePlayerStateCache } from '../services/playerStateService';
import { invalidateSeasonsCache } from '../services/seasonService';
import { checkPlayEligibility } from '../services/playerStateService';
import { submitAnswer } from '../routes/submitAnswer';

// ── Helpers to build history entries ─────────────────────────────────

const todayET = (() => {
  // Eastern today as YYYY-MM-DD → timestamp at noon ET
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(new Date());
})();

function todayTimestamp(): string {
  // Noon Eastern time today, as ISO. Guaranteed to fall on the ET day.
  return new Date(`${todayET}T16:00:00.000Z`).toISOString();
}

function yesterdayTimestamp(): string {
  return daysAgoTimestamp(1);
}

function daysAgoTimestamp(n: number): string {
  const d = new Date(`${todayET}T16:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function makeEntry(overrides: Partial<HistoryEntry> & { correct?: boolean } = {}): HistoryEntry {
  return {
    question: {
      question: 'Q?',
      choices: ['A', 'B', 'C', 'D'],
      answer: 'A',
      difficulty: 'normal',
      category: 'Test',
    },
    selectedAnswer: 'A',
    correct: true,
    timestamp: overrides.timestamp ?? todayTimestamp(),
    pointsEarned: 1,
    ...overrides,
  };
}

function regular(opts: Partial<HistoryEntry> = {}): HistoryEntry {
  return makeEntry({ ...opts });
}

function catchupAnswer(opts: Partial<HistoryEntry> = {}): HistoryEntry {
  return makeEntry({ isCatchingUp: true, ...opts });
}

function casinoRushEntry(sessionId = 'cr_1', opts: Partial<HistoryEntry> = {}): HistoryEntry {
  return makeEntry({ isCasinoRush: true, casinoSessionId: sessionId, ...opts });
}

function slotMachineEntry(opts: Partial<HistoryEntry> = {}): HistoryEntry {
  return makeEntry({ isSlotMachine: true, ...opts });
}

// Build a mock API Gateway event
function mockEvent(body: unknown) {
  return {
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/submit-answer',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
  };
}

function parseResponse(resp: { statusCode: number; body: string }) {
  const envelope = JSON.parse(resp.body);
  return {
    statusCode: resp.statusCode,
    body: envelope.ok ? envelope.data : envelope,
    reason: envelope.ok ? undefined : envelope.error,
  };
}

const validQuestion = {
  question: 'Q?',
  choices: ['A', 'B', 'C', 'D'],
  answer: 'A',
  difficulty: 'normal',
  category: 'Test',
};

// ── Setup / teardown ─────────────────────────────────────────────────

beforeEach(() => {
  resetS3Mock();
  invalidatePlayerStateCache();
  invalidateSeasonsCache();
});

// ═════════════════════════════════════════════════════════════════════
// Unit-level: checkPlayEligibility
// ═════════════════════════════════════════════════════════════════════

describe('checkPlayEligibility', () => {
  test('allows regular answer when user has no history', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    const result = await checkPlayEligibility('alice', 'regular');
    expect(result.canPlay).toBe(true);
  });

  test('blocks regular answer when user already answered a regular today', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]);

    const result = await checkPlayEligibility('alice', 'regular');
    expect(result.canPlay).toBe(false);
    expect((result as PlayEligibility & { reason?: string }).reason).toBe('daily_limit_reached');
  });

  test('allows catchup when user has gaps from prior days', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []); // 0 slots
    // Leader answered on 3 prior days — those are real gaps for alice
    seedHistory('leader', [
      regular({ timestamp: daysAgoTimestamp(3) }),
      regular({ timestamp: daysAgoTimestamp(2) }),
      regular({ timestamp: yesterdayTimestamp() }),
    ]);

    const result = await checkPlayEligibility('alice', 'catchup');
    expect(result.canPlay).toBe(true);
    expect(result.catchupAvailable).toBe(3);
  });

  test('does NOT show catch-up gap when leader played today but user has not', async () => {
    // The bug: leader plays today's daily, user now thinks they're "1 behind"
    // even though it's just the active day. Today is not a gap.
    seedDefaultActiveSeason();
    seedHistory('alice', []); // hasn't played today
    seedHistory('leader', [regular()]); // leader played today

    const result = await checkPlayEligibility('alice', 'catchup');
    expect(result.canPlay).toBe(false);
    expect(result.reason).toBe('no_catchup_available');
    expect(result.catchupAvailable).toBe(0);
  });

  test('blocks catchup when user has zero gaps', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular({ timestamp: yesterdayTimestamp() })]);
    seedHistory('leader', [regular({ timestamp: yesterdayTimestamp() })]);

    const result = await checkPlayEligibility('alice', 'catchup');
    expect(result.canPlay).toBe(false);
    expect((result as PlayEligibility & { reason?: string }).reason).toBe('no_catchup_available');
  });

  test('catchup allowed even after daily play — user can catch up in one session', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]); // played daily today
    seedHistory('leader', [regular({ timestamp: yesterdayTimestamp() }), regular()]); // 2 slots

    const result = await checkPlayEligibility('alice', 'catchup');
    expect(result.canPlay).toBe(true);
    expect(result.catchupAvailable).toBe(1);
  });

  test('blocks regular when season has ended', async () => {
    seedEndedSeason();
    seedHistory('alice', []);

    const result = await checkPlayEligibility('alice', 'regular');
    expect(result.canPlay).toBe(false);
    expect((result as PlayEligibility & { reason?: string }).reason).toBe('end_of_season');
  });

  test('blocks catchup when season has ended even if gaps exist', async () => {
    seedEndedSeason();
    seedHistory('alice', []);
    seedHistory('leader', [regular({ timestamp: yesterdayTimestamp() })]);

    const result = await checkPlayEligibility('alice', 'catchup');
    expect(result.canPlay).toBe(false);
    expect(result.reason).toBe('end_of_season');
  });

  test('catch-up does NOT count toward daily limit — regular still allowed after catch-up', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [catchupAnswer()]); // catch-up today
    seedHistory('leader', [regular(), regular()]);

    const result = await checkPlayEligibility('alice', 'regular');
    expect(result.canPlay).toBe(true);
  });

  test('casino-rush mode uses same gates as regular', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]); // already answered today

    const result = await checkPlayEligibility('alice', 'casino-rush');
    expect(result.canPlay).toBe(false);
    expect((result as PlayEligibility & { reason?: string }).reason).toBe('daily_limit_reached');
  });

  test('slot-machine mode uses same gates as regular', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]); // already answered today

    const result = await checkPlayEligibility('alice', 'slot-machine');
    expect(result.canPlay).toBe(false);
    expect((result as PlayEligibility & { reason?: string }).reason).toBe('daily_limit_reached');
  });
});

// ═════════════════════════════════════════════════════════════════════
// Route-level: submitAnswer
// ═════════════════════════════════════════════════════════════════════

describe('submitAnswer route', () => {
  test('accepts first regular answer of the day', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    const resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice',
      groupId: 'g1',
      question: validQuestion,
      selectedAnswer: 'A',
      isCatchingUp: false,
    })));

    expect(resp.statusCode).toBe(200);
    expect(resp.body.correct).toBe(true);
    expect(getHistory('alice')).toHaveLength(1);
  });

  test('rejects a 2nd regular answer on the same day', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]); // already answered today

    const resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice',
      groupId: 'g1',
      question: validQuestion,
      selectedAnswer: 'A',
      isCatchingUp: false,
    })));

    expect(resp.statusCode).toBe(403);
    expect(getHistory('alice')).toHaveLength(1); // unchanged
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // THE CORE BUG: client can bypass daily limit by sending isCatchingUp:true
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  test('BUG: rejects catchup submit when user has zero gaps', async () => {
    seedDefaultActiveSeason();
    // Alice already answered today; leader has same count → no gaps
    seedHistory('alice', [regular()]);
    seedHistory('leader', [regular()]);

    const resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice',
      groupId: 'g1',
      question: validQuestion,
      selectedAnswer: 'A',
      isCatchingUp: true, // LYING — no gaps exist
    })));

    // Before fix: this returns 200 and writes a bogus catchup entry
    // After fix: returns 403 no_catchup_available
    expect(resp.statusCode).toBe(403);
    expect(getHistory('alice')).toHaveLength(1); // unchanged
  });

  test('accepts catchup submit when user has gaps', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);
    seedHistory('leader', [
      regular({ timestamp: yesterdayTimestamp() }),
      regular(),
    ]);

    const resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice',
      groupId: 'g1',
      question: validQuestion,
      selectedAnswer: 'A',
      isCatchingUp: true,
    })));

    expect(resp.statusCode).toBe(200);
    expect(getHistory('alice')).toHaveLength(1);
    expect(getHistory('alice')[0].isCatchingUp).toBe(true);
  });

  test('rejects regular answer when season ended', async () => {
    seedEndedSeason();
    seedHistory('alice', []);

    const resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice',
      groupId: 'g1',
      question: validQuestion,
      selectedAnswer: 'A',
      isCatchingUp: false,
    })));

    expect(resp.statusCode).toBe(403);
  });

  test('blocks catchup answer when season ended', async () => {
    seedEndedSeason();
    seedHistory('alice', []);
    seedHistory('leader', [regular({ timestamp: yesterdayTimestamp() })]);

    const resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice',
      groupId: 'g1',
      question: validQuestion,
      selectedAnswer: 'A',
      isCatchingUp: true,
    })));

    expect(resp.statusCode).toBe(403);
  });

  test('2 catchup gaps → answers 2 catchups → 3rd catchup rejected (no gaps left)', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);
    seedHistory('leader', [
      regular({ timestamp: yesterdayTimestamp() }),
      regular({ timestamp: yesterdayTimestamp() }),
    ]);

    // 1st catchup
    invalidatePlayerStateCache();
    let resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice', groupId: 'g1',
      question: validQuestion, selectedAnswer: 'A',
      isCatchingUp: true,
    })));
    expect(resp.statusCode).toBe(200);

    // 2nd catchup
    invalidatePlayerStateCache();
    resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice', groupId: 'g1',
      question: validQuestion, selectedAnswer: 'A',
      isCatchingUp: true,
    })));
    expect(resp.statusCode).toBe(200);

    // 3rd catchup — no more gaps
    invalidatePlayerStateCache();
    resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice', groupId: 'g1',
      question: validQuestion, selectedAnswer: 'A',
      isCatchingUp: true,
    })));
    expect(resp.statusCode).toBe(403);
    expect(getHistory('alice')).toHaveLength(2);
  });

  test('catch-up + daily in one session — both accepted', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);
    seedHistory('leader', [regular({ timestamp: yesterdayTimestamp() })]);

    // Catchup first
    invalidatePlayerStateCache();
    let resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice', groupId: 'g1',
      question: validQuestion, selectedAnswer: 'A',
      isCatchingUp: true,
    })));
    expect(resp.statusCode).toBe(200);

    // Then today's daily
    invalidatePlayerStateCache();
    resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice', groupId: 'g1',
      question: validQuestion, selectedAnswer: 'A',
      isCatchingUp: false,
    })));
    expect(resp.statusCode).toBe(200);
    expect(getHistory('alice')).toHaveLength(2);
  });

  test('played Casino Rush today → regular answer blocked (daily limit)', async () => {
    // hasPlayedAnyGameModeToday now reads ONLY from answer history via the
    // isCasinoRush/isSlotMachine/isCurling flags. Sessions are temp state,
    // not consulted for eligibility. → CR history entry blocks regular play.
    seedDefaultActiveSeason();
    seedHistory('alice', [casinoRushEntry()]);

    const resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice', groupId: 'g1',
      question: validQuestion, selectedAnswer: 'A',
      isCatchingUp: false,
    })));

    expect(resp.statusCode).toBe(403);
  });

  test('Casino Rush session counts as 1 slot for catch-up (not 3)', async () => {
    // This verifies the rule: Casino Rush session (3 sub-questions) = 1 slot.
    // If a user plays CR, their catchupBehind should go down by 1, not 3.
    seedDefaultActiveSeason();
    // Leader: 3 regular answers
    seedHistory('leader', [
      regular({ timestamp: yesterdayTimestamp() }),
      regular({ timestamp: yesterdayTimestamp() }),
      regular({ timestamp: yesterdayTimestamp() }),
    ]);
    // Alice: 1 casino rush session (3 entries, same sessionId) = 1 slot
    seedHistory('alice', [
      casinoRushEntry('cr_1', { timestamp: yesterdayTimestamp() }),
      casinoRushEntry('cr_1', { timestamp: yesterdayTimestamp() }),
      casinoRushEntry('cr_1', { timestamp: yesterdayTimestamp() }),
    ]);

    const result = await checkPlayEligibility('alice', 'catchup');
    // Alice has 1 slot (the CR session), leader has 3, so Alice is 2 behind
    expect(result.canPlay).toBe(true);
    expect(result.catchupAvailable).toBe(2);
  });

  test('Casino Rush entries MUST share casinoSessionId to collapse to 1 slot', async () => {
    // Defensive: if sessionIds are missing or differ, each entry counts separately.
    // This documents the contract — the writer MUST set casinoSessionId.
    seedDefaultActiveSeason();
    seedHistory('alice', [
      casinoRushEntry('cr_1', { timestamp: yesterdayTimestamp() }),
      casinoRushEntry('cr_1', { timestamp: yesterdayTimestamp() }),
      casinoRushEntry('cr_1', { timestamp: yesterdayTimestamp() }),
    ]);
    seedHistory('leader', [
      regular({ timestamp: yesterdayTimestamp() }),
      regular({ timestamp: yesterdayTimestamp() }),
    ]);

    const result = await checkPlayEligibility('alice', 'catchup');
    // 1 CR session = 1 slot. Leader has 2. So alice is 1 behind.
    expect(result.catchupAvailable).toBe(1);
  });

  test('played Slot Machine today → regular answer blocked (daily limit)', async () => {
    // Same as above: isSlotMachine flag in history blocks further plays today.
    seedDefaultActiveSeason();
    seedHistory('alice', [slotMachineEntry()]);

    const resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice', groupId: 'g1',
      question: validQuestion, selectedAnswer: 'A',
      isCatchingUp: false,
    })));

    expect(resp.statusCode).toBe(403);
  });

  // ── THE SCENARIO: full catch-up session + daily ────────────────
  // User is 3 behind, answers all 3 catch-up + today's daily = 4 questions.
  // After that, ALL modes should be blocked (daily used, no gaps left).

  test('full catch-up session + daily → everything blocked after', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);
    seedHistory('leader', [
      regular({ timestamp: daysAgoTimestamp(3) }),
      regular({ timestamp: daysAgoTimestamp(2) }),
      regular({ timestamp: yesterdayTimestamp() }),
      regular(), // today
    ]); // leader has 4 slots, alice has 0 → 4 gaps

    // 3 catch-up answers (one per "missed day")
    for (let i = 0; i < 3; i++) {
      invalidatePlayerStateCache();
      const resp = parseResponse(await submitAnswer(mockEvent({
        userId: 'alice', groupId: 'g1',
        question: validQuestion, selectedAnswer: 'A',
        isCatchingUp: true,
      })));
      expect(resp.statusCode).toBe(200);
    }

    // Today's daily
    invalidatePlayerStateCache();
    let resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice', groupId: 'g1',
      question: validQuestion, selectedAnswer: 'A',
      isCatchingUp: false,
    })));
    expect(resp.statusCode).toBe(200);
    expect(getHistory('alice')).toHaveLength(4);

    // Now EVERYTHING should be blocked
    invalidatePlayerStateCache();

    // Regular — blocked (daily used)
    let elig = await checkPlayEligibility('alice', 'regular');
    expect(elig.canPlay).toBe(false);
    expect(elig.reason).toBe('daily_limit_reached');

    // Catch-up — blocked (no gaps)
    elig = await checkPlayEligibility('alice', 'catchup');
    expect(elig.canPlay).toBe(false);
    expect(elig.reason).toBe('no_catchup_available');

    // Casino Rush — blocked (daily used)
    elig = await checkPlayEligibility('alice', 'casino-rush');
    expect(elig.canPlay).toBe(false);
    expect(elig.reason).toBe('daily_limit_reached');
  });

  test('daily first, then catch-up → both allowed, then blocked', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);
    seedHistory('leader', [
      regular({ timestamp: yesterdayTimestamp() }),
      regular(), // today
    ]); // 2 slots, alice has 0 → 2 gaps

    // Daily first
    invalidatePlayerStateCache();
    let resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice', groupId: 'g1',
      question: validQuestion, selectedAnswer: 'A',
      isCatchingUp: false,
    })));
    expect(resp.statusCode).toBe(200);

    // Catch-up (1 gap remaining)
    invalidatePlayerStateCache();
    resp = parseResponse(await submitAnswer(mockEvent({
      userId: 'alice', groupId: 'g1',
      question: validQuestion, selectedAnswer: 'A',
      isCatchingUp: true,
    })));
    expect(resp.statusCode).toBe(200);

    // Another catch-up — blocked (no gaps left)
    invalidatePlayerStateCache();
    const elig = await checkPlayEligibility('alice', 'catchup');
    expect(elig.canPlay).toBe(false);
    expect(elig.reason).toBe('no_catchup_available');
    expect(elig.catchupAvailable).toBe(0);
  });
});
