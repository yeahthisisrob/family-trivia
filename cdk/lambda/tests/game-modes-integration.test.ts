/**
 * Integration tests for game-mode eligibility + cooldown enforcement.
 *
 * Verifies that Casino Rush and Slot Machine correctly enforce:
 * - Daily limit (shared with regular trivia via checkPlayEligibility)
 * - End-of-season block
 * - Per-game cooldowns (7 days for both)
 * - Catchup bypass of daily limit when gaps exist
 */

jest.mock('../services/s3', () => require('./helpers/s3Mock').s3MockModule);
jest.mock('../services/bedrock/questions/trivia', () => ({ generateQuestion: jest.fn() }));
jest.mock('../services/questionPipeline', () => ({ generateBestQuestion: jest.fn() }));
// Stub out shared question-generation module so we can test start/spin without
// actually generating questions from Bedrock.
jest.mock('../routes/questionGeneration/shared', () => ({
  generateQuestionWithOptions: jest.fn().mockResolvedValue({
    question: {
      question: 'Mock Q?',
      choices: ['A', 'B', 'C', 'D'],
      answer: 'A',
      category: 'Science & Nature',
      difficulty: 'normal',
    },
    messages: [],
  }),
  validateGeneratedQuestion: jest.fn().mockReturnValue(true),
}));
// Stub out game-modes/shared so getAvailableCategories doesn't hit S3
jest.mock('../routes/game-modes/shared', () => ({
  getAvailableCategories: jest.fn().mockResolvedValue([
    'Science & Nature', 'History & Politics', 'Geography & Travel',
  ]),
}));

import type { HistoryEntry } from '@family-trivia/shared';
import { resetS3Mock, seedHistory, seedDefaultActiveSeason } from './helpers/s3Mock';
import { invalidatePlayerStateCache } from '../services/playerStateService';
import { invalidateSeasonsCache } from '../services/seasonService';
import { invalidateGameModeCache } from '../services/gameModeService';
import { casinoRushStartGame } from '../routes/game-modes/casinoRush';

// ── helpers ──────────────────────────────────────────────────────────

const todayET = (() => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(new Date());
})();

function todayTimestamp(): string {
  return new Date(`${todayET}T16:00:00.000Z`).toISOString();
}

function yesterdayTimestamp(): string {
  const d = new Date(`${todayET}T16:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString();
}

function daysAgoTimestamp(days: number): string {
  const d = new Date(`${todayET}T16:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function regular(opts: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    question: { question: 'Q?', choices: ['A','B','C','D'], answer: 'A', difficulty: 'normal', category: 'Test' },
    selectedAnswer: 'A', correct: true, timestamp: todayTimestamp(),
    pointsEarned: 1, ...opts,
  };
}

function casinoRushEntry(sessionId = 'cr_1', opts: Partial<HistoryEntry> = {}): HistoryEntry {
  return { ...regular(), isCasinoRush: true, casinoSessionId: sessionId, ...opts };
}

function mockEvent(body: unknown) {
  return {
    body: JSON.stringify(body),
    headers: {}, multiValueHeaders: {},
    httpMethod: 'POST', isBase64Encoded: false,
    path: '/casino-rush/start', pathParameters: null,
    queryStringParameters: null, multiValueQueryStringParameters: null,
    stageVariables: null, requestContext: {} as any, resource: '',
  };
}

function parseResponse(resp: { statusCode: number; body: string }) {
  const envelope = JSON.parse(resp.body);
  return {
    statusCode: resp.statusCode,
    body: envelope.ok ? envelope.data : envelope,
  };
}

beforeEach(() => {
  resetS3Mock();
  invalidatePlayerStateCache();
  invalidateSeasonsCache();
  invalidateGameModeCache();
});

// ═══════════════════════════════════════════════════════════════════
// Casino Rush — start eligibility
// ═══════════════════════════════════════════════════════════════════

describe('casinoRushStartGame', () => {
  test('fresh user (no history) can start', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    const resp = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'normal',
    })));
    expect(resp.statusCode).toBe(200);
  });

  test('user who answered regular today is blocked by daily limit', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]); // answered today

    const resp = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'normal',
    })));
    expect(resp.statusCode).toBe(403);
  });

  test('weekly cooldown: played CR 3 days ago → blocked', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [casinoRushEntry('cr_old', { timestamp: daysAgoTimestamp(3) })]);

    const resp = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'normal',
    })));
    expect(resp.statusCode).toBe(403);
  });

  test('weekly cooldown: played CR 8 days ago → allowed', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [casinoRushEntry('cr_old', { timestamp: daysAgoTimestamp(8) })]);

    const resp = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'normal',
    })));
    expect(resp.statusCode).toBe(200);
  });

  test('catchup mode allowed even after daily play — catch up in one session', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]); // played daily today
    seedHistory('leader', [
      regular({ timestamp: yesterdayTimestamp() }),
      regular(),
    ]); // 2 slots vs alice's 1 → 1 gap

    const resp = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'normal', isCatchingUp: true,
    })));
    expect(resp.statusCode).toBe(200);
  });

  test('catchup mode blocked when no gaps', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]);
    seedHistory('leader', [regular()]);

    const resp = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'normal', isCatchingUp: true,
    })));
    expect(resp.statusCode).toBe(403);
  });

  test('catchup mode still respects CR cooldown', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [
      casinoRushEntry('cr_recent', { timestamp: daysAgoTimestamp(2) }),
    ]);
    seedHistory('leader', [
      regular({ timestamp: yesterdayTimestamp() }),
      regular({ timestamp: yesterdayTimestamp() }),
    ]);

    // Has gaps BUT weekly cooldown hasn't passed
    const resp = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'normal', isCatchingUp: true,
    })));
    expect(resp.statusCode).toBe(403);
  });

  test('invalid difficulty rejected', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    const resp = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'impossible',
    })));
    expect(resp.statusCode).toBe(400);
  });

  test('missing userId rejected', async () => {
    const resp = parseResponse(await casinoRushStartGame(mockEvent({
      difficulty: 'normal',
    })));
    expect(resp.statusCode).toBe(400);
  });

  // ── Session lifecycle: the "empty session" bug ─────────────────

  test('successful start writes session with questions to S3', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    const resp = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'normal',
    })));
    expect(resp.statusCode).toBe(200);

    // Session should be persisted with actual questions
    const stored = getStored<any>('casino-rush/alice/current-session.json');
    expect(stored).toBeDefined();
    expect(stored.status).toBe('active');
    expect(stored.questions.length).toBeGreaterThan(0);
    expect(stored.questions[0].question).toBeDefined();
  });

  test('no empty session left in S3 when question generation fails', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    // Make question generation fail
    const { generateQuestionWithOptions } = require('../routes/questionGeneration/shared');
    generateQuestionWithOptions.mockRejectedValueOnce(new Error('Bedrock timeout'));

    const resp = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'normal',
    })));
    expect(resp.statusCode).toBe(500);

    // No session should be in S3 — the old bug left an empty one
    const stored = getStored<any>('casino-rush/alice/current-session.json');
    expect(stored).toBeUndefined();
  });

  test('no empty session left when question validation fails', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    // Make validation fail
    const { validateGeneratedQuestion } = require('../routes/questionGeneration/shared');
    validateGeneratedQuestion.mockReturnValueOnce(false);

    const resp = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'normal',
    })));
    expect(resp.statusCode).toBe(500);

    const stored = getStored<any>('casino-rush/alice/current-session.json');
    expect(stored).toBeUndefined();
  });

  test('can start a new game after a failed attempt (no stale lock)', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    // First attempt fails
    const { generateQuestionWithOptions } = require('../routes/questionGeneration/shared');
    generateQuestionWithOptions.mockRejectedValueOnce(new Error('Bedrock timeout'));

    const resp1 = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'normal',
    })));
    expect(resp1.statusCode).toBe(500);

    // Restore mock for second attempt
    generateQuestionWithOptions.mockResolvedValue({
      question: {
        question: 'Mock Q?', choices: ['A', 'B', 'C', 'D'],
        answer: 'A', category: 'Science & Nature', difficulty: 'normal',
      },
      messages: [],
    });

    // Second attempt should succeed — no stale active session blocking
    const resp2 = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'normal',
    })));
    expect(resp2.statusCode).toBe(200);
    expect(resp2.body.session.currentQuestion).toBeDefined();
  });

  test('resume returns valid session with currentQuestion', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    // Start a game (creates session with questions)
    const resp1 = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'normal',
    })));
    expect(resp1.statusCode).toBe(200);

    // "Resume" by starting again — should return the existing session
    const resp2 = parseResponse(await casinoRushStartGame(mockEvent({
      userId: 'alice', difficulty: 'normal',
    })));
    expect(resp2.statusCode).toBe(200);
    expect(resp2.body.session.currentQuestion).toBeDefined();
    expect(resp2.body.session.resumed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Curling — lock + answer
// ═══════════════════════════════════════════════════════════════════

import { curlingLock, curlingAnswer } from '../routes/game-modes/curling';
import { getStored } from './helpers/s3Mock';

function curlingEntry(mult: number, opts: Partial<HistoryEntry> = {}): HistoryEntry {
  return { ...regular(), isCurling: true, curlingMultiplier: mult, ...opts };
}

describe('curlingLock', () => {
  test('fresh user: locks multiplier and returns a question', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    const resp = parseResponse(await curlingLock(mockEvent({
      userId: 'alice', multiplier: 3,
    })));
    expect(resp.statusCode).toBe(200);
    expect(resp.body.multiplier).toBe(3);
    expect(resp.body.question).toBeDefined();
    expect(resp.body.question.choices).toHaveLength(4);
    // Session should be persisted
    expect(getStored('curling/alice/session.json')).toBeTruthy();
  });

  test('rejects invalid multiplier', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    const resp = parseResponse(await curlingLock(mockEvent({
      userId: 'alice', multiplier: 7,
    })));
    expect(resp.statusCode).toBe(400);
  });

  test('blocked when user answered regular today (daily limit)', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]);

    const resp = parseResponse(await curlingLock(mockEvent({
      userId: 'alice', multiplier: 2,
    })));
    expect(resp.statusCode).toBe(403);
  });

  test('blocked when weekly cooldown not elapsed', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [curlingEntry(2, { timestamp: daysAgoTimestamp(3) })]);

    const resp = parseResponse(await curlingLock(mockEvent({
      userId: 'alice', multiplier: 2,
    })));
    expect(resp.statusCode).toBe(403);
  });

  test('allowed after 8-day cooldown', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [curlingEntry(2, { timestamp: daysAgoTimestamp(8) })]);

    const resp = parseResponse(await curlingLock(mockEvent({
      userId: 'alice', multiplier: 3,
    })));
    expect(resp.statusCode).toBe(200);
  });
});

describe('curlingAnswer', () => {
  async function setupSession(userId: string, multiplier: number) {
    seedDefaultActiveSeason();
    seedHistory(userId, []);
    await curlingLock(mockEvent({ userId, multiplier }));
  }

  test('correct answer awards multiplier points + writes history', async () => {
    await setupSession('alice', 3);

    const resp = parseResponse(await curlingAnswer(mockEvent({
      userId: 'alice', answer: 'A', // mock question answer is 'A'
    })));
    expect(resp.statusCode).toBe(200);
    expect(resp.body.correct).toBe(true);
    expect(resp.body.pointsEarned).toBe(3);

    const history = getStored('answers/history/alice.json') as any[];
    expect(history).toHaveLength(1);
    expect(history[0].isCurling).toBe(true);
    expect(history[0].curlingMultiplier).toBe(3);
    expect(history[0].pointsEarned).toBe(3);
  });

  test('wrong answer awards 0 points but still writes history', async () => {
    await setupSession('alice', 2);

    const resp = parseResponse(await curlingAnswer(mockEvent({
      userId: 'alice', answer: 'B',
    })));
    expect(resp.statusCode).toBe(200);
    expect(resp.body.correct).toBe(false);
    expect(resp.body.pointsEarned).toBe(0);

    const history = getStored('answers/history/alice.json') as any[];
    expect(history).toHaveLength(1);
    expect(history[0].isCurling).toBe(true);
    expect(history[0].curlingMultiplier).toBe(2);
    expect(history[0].correct).toBe(false);
  });

  test('no session → 400', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    const resp = parseResponse(await curlingAnswer(mockEvent({
      userId: 'alice', answer: 'A',
    })));
    expect(resp.statusCode).toBe(400);
  });

  test('session deleted after answer', async () => {
    await setupSession('alice', 1);
    expect(getStored('curling/alice/session.json')).toBeTruthy();

    await curlingAnswer(mockEvent({ userId: 'alice', answer: 'A' }));

    expect(getStored('curling/alice/session.json')).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// canPlayGameMode — combined cooldown + daily limit check
// ═══════════════════════════════════════════════════════════════════

import { canPlayGameMode, canPlayGameModeAny } from '../services/gameModeService';

describe('canPlayGameMode', () => {
  test('fresh user can play', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);
    const result = await canPlayGameMode('alice', 'curling');
    expect(result.canPlay).toBe(true);
    expect(result.nextAvailable).toBeNull();
  });

  test('blocked by daily limit even when cooldown is fine', async () => {
    // This is THE bug: cooldown fine, but user played today
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]); // answered regular today
    const result = await canPlayGameMode('alice', 'curling');
    expect(result.canPlay).toBe(false);
    expect(result.blockedReason).toBe('daily_limit_reached');
  });

  test('blocked by cooldown even when daily limit is fine', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [curlingEntry(2, { timestamp: daysAgoTimestamp(3) })]);
    // Note: curlingEntry uses today's timestamp by default; we override with 3 days ago.
    // The regular() base also has today's timestamp — need to override that too.
    seedHistory('alice', [{ ...regular({ timestamp: daysAgoTimestamp(3) }), isCurling: true, curlingMultiplier: 2 }]);
    const result = await canPlayGameMode('alice', 'curling');
    expect(result.canPlay).toBe(false);
    expect(result.blockedReason).toBe('cooldown');
  });

  test('playing any game mode today blocks curling (history-based)', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [casinoRushEntry('cr_today')]);
    const result = await canPlayGameMode('alice', 'curling');
    expect(result.canPlay).toBe(false);
    expect(result.blockedReason).toBe('daily_limit_reached');
  });

  test('catchup allowed even after daily play — user has gaps', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]); // played daily today
    seedHistory('leader', [
      regular({ timestamp: yesterdayTimestamp() }),
      regular(),
    ]); // leader has 2 slots, alice 1 → 1 gap
    const result = await canPlayGameMode('alice', 'curling', 'catchup');
    expect(result.canPlay).toBe(true);
  });

  test('catchup still respects weekly cooldown', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [
      { ...regular({ timestamp: daysAgoTimestamp(2) }), isCurling: true, curlingMultiplier: 2 },
    ]);
    seedHistory('leader', [
      regular({ timestamp: yesterdayTimestamp() }),
      regular({ timestamp: yesterdayTimestamp() }),
    ]); // 2 gaps for alice
    const result = await canPlayGameMode('alice', 'curling', 'catchup');
    expect(result.canPlay).toBe(false);
    expect(result.blockedReason).toBe('cooldown');
  });

});

describe('canPlayGameModeAny', () => {
  test('played today but has catchup gap → tile shows playable', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]); // played daily today
    seedHistory('leader', [
      regular({ timestamp: yesterdayTimestamp() }),
      regular(),
    ]); // leader has 2 slots, alice 1 → 1 gap
    const result = await canPlayGameModeAny('alice', 'curling');
    expect(result.canPlay).toBe(true);
  });

  test('played today, no catchup gaps → blocked', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]);
    seedHistory('leader', [regular()]); // no gap
    const result = await canPlayGameModeAny('alice', 'curling');
    expect(result.canPlay).toBe(false);
    expect(result.blockedReason).toBe('daily_limit_reached');
  });

  test('weekly cooldown in effect → blocked regardless of catchup', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [
      { ...regular({ timestamp: daysAgoTimestamp(2) }), isCurling: true, curlingMultiplier: 2 },
    ]);
    seedHistory('leader', [
      regular({ timestamp: yesterdayTimestamp() }),
      regular({ timestamp: yesterdayTimestamp() }),
    ]); // 2 gaps but curling on cooldown
    const result = await canPlayGameModeAny('alice', 'curling');
    expect(result.canPlay).toBe(false);
    expect(result.blockedReason).toBe('cooldown');
  });

  test('fresh user (no history) → playable', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);
    const result = await canPlayGameModeAny('alice', 'curling');
    expect(result.canPlay).toBe(true);
  });
});
