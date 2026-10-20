/**
 * Integration tests for game-mode eligibility + cooldown enforcement.
 *
 * Verifies that Casino Rush and Slot Machine correctly enforce:
 * - Daily limit (shared with regular trivia via checkPlayEligibility)
 * - End-of-season block
 * - Per-game cooldowns (7 days for both)
 * - Catchup bypass of daily limit when gaps exist
 */

vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);
vi.mock('../services/bedrock/questions/trivia', () => ({ generateQuestion: vi.fn() }));
vi.mock('../services/questionPipeline', () => ({ generateBestQuestion: vi.fn() }));
// Stub out shared question-generation module so we can test start/spin without
// actually generating questions from Bedrock.
vi.mock('../routes/questionGeneration/shared', () => ({
  generateQuestionWithOptions: vi.fn().mockResolvedValue({
    question: {
      question: 'Mock Q?',
      choices: ['A', 'B', 'C', 'D'],
      answer: 'A',
      category: 'Science & Nature',
      difficulty: 'normal',
    },
    messages: [],
  }),
  validateGeneratedQuestion: vi.fn().mockReturnValue(true),
}));
// Stub out the games' categories so getAvailableCategories doesn't hit S3
vi.mock('../features/games/categories', () => ({
  getAvailableCategories: vi
    .fn()
    .mockResolvedValue(['Science & Nature', 'History & Politics', 'Geography & Travel']),
}));

import type { HistoryEntry } from '@family-trivia/shared';
import { casinoRushStartGame } from '../features/games/casino-rush/handlers';
import { invalidateGameModeCache } from '../services/gameModeService';
import { invalidatePlayerStateCache } from '../services/playerStateService';
import { invalidateSeasonsCache } from '../services/seasonService';
import { resetS3Mock, seedDefaultActiveSeason, seedHistory } from './helpers/s3Mock';

// ── helpers ──────────────────────────────────────────────────────────

const todayET = (() => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
})();

function todayTimestamp(): string {
  return new Date(`${todayET}T16:00:00.000Z`).toISOString();
}

function daysAgoTimestamp(days: number): string {
  const d = new Date(`${todayET}T16:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function regular(opts: Partial<HistoryEntry> = {}): HistoryEntry {
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
    timestamp: todayTimestamp(),
    pointsEarned: 1,
    ...opts,
  };
}

function casinoRushEntry(sessionId = 'cr_1', opts: Partial<HistoryEntry> = {}): HistoryEntry {
  return { ...regular(), isCasinoRush: true, casinoSessionId: sessionId, ...opts };
}

function mockEvent(body: unknown) {
  return {
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/casino-rush/start',
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

    const resp = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'normal',
        }),
      ),
    );
    expect(resp.statusCode).toBe(200);
  });

  test('user who answered regular today is blocked by daily limit', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]); // answered today

    const resp = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'normal',
        }),
      ),
    );
    expect(resp.statusCode).toBe(403);
  });

  test('weekly cooldown: played CR 3 days ago → blocked', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [casinoRushEntry('cr_old', { timestamp: daysAgoTimestamp(3) })]);

    const resp = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'normal',
        }),
      ),
    );
    expect(resp.statusCode).toBe(403);
  });

  test('weekly cooldown: played CR 8 days ago → allowed', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [casinoRushEntry('cr_old', { timestamp: daysAgoTimestamp(8) })]);

    const resp = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'normal',
        }),
      ),
    );
    expect(resp.statusCode).toBe(200);
  });

  test('catchup mode allowed even after daily play — catch up in one session', async () => {
    seedDefaultActiveSeason();
    // First played 2 days ago, then today's daily → 1 gap (yesterday)
    seedHistory('alice', [regular({ timestamp: daysAgoTimestamp(2) }), regular()]);

    const resp = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'normal',
          isCatchingUp: true,
        }),
      ),
    );
    expect(resp.statusCode).toBe(200);
  });

  test('catchup mode blocked when no gaps', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]); // first play today → nothing owed

    const resp = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'normal',
          isCatchingUp: true,
        }),
      ),
    );
    expect(resp.statusCode).toBe(403);
  });

  test('catchup mode still respects CR cooldown', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [casinoRushEntry('cr_recent', { timestamp: daysAgoTimestamp(2) })]); // 1 gap

    // Has gaps BUT weekly cooldown hasn't passed
    const resp = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'normal',
          isCatchingUp: true,
        }),
      ),
    );
    expect(resp.statusCode).toBe(403);
  });

  test('invalid difficulty rejected', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    const resp = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'impossible',
        }),
      ),
    );
    expect(resp.statusCode).toBe(400);
  });

  test('missing userId rejected', async () => {
    const resp = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          difficulty: 'normal',
        }),
      ),
    );
    expect(resp.statusCode).toBe(400);
  });

  // ── Session lifecycle: the "empty session" bug ─────────────────

  test('successful start writes session with questions to S3', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    const resp = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'normal',
        }),
      ),
    );
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
    const generateQuestionWithOptions = vi.mocked(
      (await import('../routes/questionGeneration/shared')).generateQuestionWithOptions,
    );
    generateQuestionWithOptions.mockRejectedValueOnce(new Error('Bedrock timeout'));

    const resp = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'normal',
        }),
      ),
    );
    expect(resp.statusCode).toBe(500);

    // No session should be in S3 — the old bug left an empty one
    const stored = getStored<any>('casino-rush/alice/current-session.json');
    expect(stored).toBeUndefined();
  });

  test('no empty session left when question validation fails', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    // Make validation fail
    const validateGeneratedQuestion = vi.mocked(
      (await import('../routes/questionGeneration/shared')).validateGeneratedQuestion,
    );
    validateGeneratedQuestion.mockReturnValueOnce(false);

    const resp = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'normal',
        }),
      ),
    );
    expect(resp.statusCode).toBe(500);

    const stored = getStored<any>('casino-rush/alice/current-session.json');
    expect(stored).toBeUndefined();
  });

  test('can start a new game after a failed attempt (no stale lock)', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    // First attempt fails
    const generateQuestionWithOptions = vi.mocked(
      (await import('../routes/questionGeneration/shared')).generateQuestionWithOptions,
    );
    generateQuestionWithOptions.mockRejectedValueOnce(new Error('Bedrock timeout'));

    const resp1 = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'normal',
        }),
      ),
    );
    expect(resp1.statusCode).toBe(500);

    // Restore mock for second attempt
    generateQuestionWithOptions.mockResolvedValue({
      question: {
        question: 'Mock Q?',
        choices: ['A', 'B', 'C', 'D'],
        answer: 'A',
        category: 'Science & Nature',
        difficulty: 'normal',
      },
      messages: [],
    });

    // Second attempt should succeed — no stale active session blocking
    const resp2 = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'normal',
        }),
      ),
    );
    expect(resp2.statusCode).toBe(200);
    expect(resp2.body.session.currentQuestion).toBeDefined();
  });

  test('resume returns valid session with currentQuestion', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);

    // Start a game (creates session with questions)
    const resp1 = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'normal',
        }),
      ),
    );
    expect(resp1.statusCode).toBe(200);

    // "Resume" by starting again — should return the existing session
    const resp2 = parseResponse(
      await casinoRushStartGame(
        mockEvent({
          userId: 'alice',
          difficulty: 'normal',
        }),
      ),
    );
    expect(resp2.statusCode).toBe(200);
    expect(resp2.body.session.currentQuestion).toBeDefined();
    expect(resp2.body.session.resumed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Rounds — any game: lock a multiplier, then answer (0032)
// ═══════════════════════════════════════════════════════════════════

import { postRoundAnswer, postRoundLock } from '../features/games/handlers';
import { getStored } from './helpers/s3Mock';

function curlingEntry(mult: number, opts: Partial<HistoryEntry> = {}): HistoryEntry {
  return { ...regular(), isCurling: true, curlingMultiplier: mult, ...opts };
}

const lock = async (me: string, body: Record<string, unknown>) =>
  parseResponse(await postRoundLock(mockEvent(body), me));
const answer = async (me: string, body: Record<string, unknown>) =>
  parseResponse(await postRoundAnswer(mockEvent(body), me));

describe('round lock', () => {
  test('fresh user: locks multiplier and returns a question', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);
    const resp = await lock('alice', { game: 'curling', multiplier: 3 });
    expect(resp.statusCode).toBe(200);
    expect(resp.body.multiplier).toBe(3);
    expect(resp.body.question.choices).toHaveLength(4);
    expect(resp.body.question.answer).toBeUndefined();
    expect(getStored('games/rounds/alice.json')).toBeTruthy();
  });

  test('works for a game nobody registered', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);
    expect((await lock('alice', { game: 'word-ladder', multiplier: 2 })).statusCode).toBe(200);
  });

  test('rejects a multiplier outside the rules, and bad ids', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', []);
    expect((await lock('alice', { game: 'curling', multiplier: 7 })).statusCode).toBe(400);
    expect((await lock('alice', { game: '../x', multiplier: 2 })).statusCode).toBe(400);
  });

  test('blocked when user answered regular today (daily limit)', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]);
    expect((await lock('alice', { game: 'curling', multiplier: 2 })).statusCode).toBe(403);
  });

  test('blocked when weekly cooldown not elapsed (old curling entries count)', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [curlingEntry(2, { timestamp: daysAgoTimestamp(3) })]);
    const resp = await lock('alice', { game: 'curling', multiplier: 2 });
    expect(resp.statusCode).toBe(403);
    expect(resp.body.errorType).toBe('cooldown');
  });

  test('allowed after 8-day cooldown', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [curlingEntry(2, { timestamp: daysAgoTimestamp(8) })]);
    expect((await lock('alice', { game: 'curling', multiplier: 3 })).statusCode).toBe(200);
  });
});

describe('round answer', () => {
  async function setup(userId: string, body: Record<string, unknown>) {
    seedDefaultActiveSeason();
    seedHistory(userId, []);
    await lock(userId, body);
  }

  test('correct answer awards multiplier points + writes history', async () => {
    await setup('alice', { game: 'curling', multiplier: 3 });
    const resp = await answer('alice', { game: 'curling', answer: 'A' });
    expect(resp.body.correct).toBe(true);
    expect(resp.body.pointsEarned).toBe(3);
    const history = getStored('answers/history/alice.json') as HistoryEntry[];
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ gameMode: 'curling', multiplier: 3, pointsEarned: 3 });
  });

  test('wrong answer awards 0 points but still writes history', async () => {
    await setup('alice', { game: 'curling', multiplier: 2 });
    const resp = await answer('alice', { game: 'curling', answer: 'B' });
    expect(resp.body.pointsEarned).toBe(0);
    const history = getStored('answers/history/alice.json') as HistoryEntry[];
    expect(history[0]).toMatchObject({ gameMode: 'curling', correct: false });
  });

  test('a new best score in the game adds the bonus', async () => {
    await setup('alice', { game: 'tetris', multiplier: 2, score: 500 });
    const resp = await answer('alice', { game: 'tetris', answer: 'A' });
    expect(resp.body.newBestBonus).toBe(1);
    expect(resp.body.pointsEarned).toBe(3);
  });

  test('the round played counts toward the cooldown', async () => {
    await setup('alice', { game: 'curling', multiplier: 2 });
    await answer('alice', { game: 'curling', answer: 'A' });
    invalidateGameModeCache();
    invalidatePlayerStateCache();
    const again = await lock('alice', { game: 'curling', multiplier: 2, catchUp: true });
    expect(again.statusCode).toBe(403);
  });

  test('no round, or a different game → 400', async () => {
    await setup('alice', { game: 'curling', multiplier: 2 });
    expect((await answer('alice', { game: 'tetris', answer: 'A' })).statusCode).toBe(400);
    expect((await answer('bob', { game: 'curling', answer: 'A' })).statusCode).toBe(400);
  });

  test('round deleted after answer', async () => {
    await setup('alice', { game: 'curling', multiplier: 1 });
    await answer('alice', { game: 'curling', answer: 'A' });
    expect(getStored('games/rounds/alice.json')).toBeUndefined();
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
    seedHistory('alice', [
      { ...regular({ timestamp: daysAgoTimestamp(3) }), isCurling: true, curlingMultiplier: 2 },
    ]);
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
    // First played 2 days ago, then today's daily → 1 gap (yesterday)
    seedHistory('alice', [regular({ timestamp: daysAgoTimestamp(2) }), regular()]);
    const result = await canPlayGameMode('alice', 'curling', 'catchup');
    expect(result.canPlay).toBe(true);
  });

  test('catchup still respects weekly cooldown', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [
      { ...regular({ timestamp: daysAgoTimestamp(2) }), isCurling: true, curlingMultiplier: 2 },
    ]); // 1 gap (yesterday)
    const result = await canPlayGameMode('alice', 'curling', 'catchup');
    expect(result.canPlay).toBe(false);
    expect(result.blockedReason).toBe('cooldown');
  });
});

describe('canPlayGameModeAny', () => {
  test('played today but has catchup gap → tile shows playable', async () => {
    seedDefaultActiveSeason();
    // First played 2 days ago, then today's daily → 1 gap (yesterday)
    seedHistory('alice', [regular({ timestamp: daysAgoTimestamp(2) }), regular()]);
    const result = await canPlayGameModeAny('alice', 'curling');
    expect(result.canPlay).toBe(true);
  });

  test('played today, no catchup gaps → blocked', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [regular()]); // first play today → no gap
    const result = await canPlayGameModeAny('alice', 'curling');
    expect(result.canPlay).toBe(false);
    expect(result.blockedReason).toBe('daily_limit_reached');
  });

  test('weekly cooldown in effect → blocked regardless of catchup', async () => {
    seedDefaultActiveSeason();
    seedHistory('alice', [
      { ...regular({ timestamp: daysAgoTimestamp(2) }), isCurling: true, curlingMultiplier: 2 },
    ]); // 1 gap but curling on cooldown
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
