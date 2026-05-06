// File: lambda/routes/familyFeud.ts
// Purpose: Family Feud round-robin game mode endpoints.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson } from '../services/s3';
import { successResponse, errorResponse, AVAILABLE_MODELS } from '../config';
import { S3_PATHS } from '../constants';
import { logger } from '../services/logger';
import { writeFeudNewRoundNotification } from '../services/notificationService';
import {
  getCurrentRound,
  getRotation,
  getTimesAsTarget,
  createRound,
  submitTargetAnswer,
  submitGuess,
  completeRound,
  advanceRotation,
  passTurn,
  getRecentRounds,
  resetCurrentRound,
  deleteRound,
  resetRotation,
  FamilyFeudRound,
  getRotationStats,
} from '../services/familyFeudService';
import { invokeBedrockPrompt } from '../services/bedrock/core/bedrockClient';
import { collectResponseBody, extractJsonFromResponse } from '../services/bedrock/core/responseParser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface HierarchyData {
  family: {
    people: Record<string, { name: string; groupId?: string; [key: string]: any }>;
    [key: string]: any;
  };
}

async function getAllPeopleIds(): Promise<{ ids: string[]; names: Record<string, string> }> {
  const hierarchy = await getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY);
  if (!hierarchy?.family?.people) return { ids: [], names: {} };
  const ids = Object.keys(hierarchy.family.people);
  const names: Record<string, string> = {};
  for (const [id, person] of Object.entries(hierarchy.family.people)) {
    names[id] = person.name || id;
  }
  return { ids, names };
}

/**
 * Generate a fun personal question using AI.
 * Different from daily facts — these are designed to be guessable by family.
 */
async function generateFeudQuestion(targetUserName: string): Promise<string> {
  // Load ALL previous feud questions to avoid repeats
  const previousRounds = await getRecentRounds(100);
  const previousQuestions = previousRounds
    .filter(r => r.question)
    .map(r => r.question);

  const previousList = previousQuestions.length > 0
    ? previousQuestions.map((q, i) => `${i + 1}. "${q}"`).join('\n')
    : 'None yet';

  const prompt = `Generate ONE fun personal trivia question for a family game called "Family Feud".
The question is about ${targetUserName}. Other family members will try to guess their answer.

Requirements:
- The question should be fun and something family members might be able to guess
- It should have a SHORT answer (1-5 words), not a long story
- It should NOT be too private or embarrassing
- It should be interesting enough that people want to guess
- Do NOT include the person's name in the question — just say "you"
- MUST be completely different from all previously asked questions

Good examples:
- "What's the one meal you could eat every day and never get tired of?"
- "What's your go-to karaoke song?"
- "What movie can you quote the most lines from?"
- "What's the most embarrassing thing you've ever worn?"
- "If you could only watch one TV show for the rest of your life, what would it be?"

PREVIOUSLY ASKED (DO NOT REPEAT OR REPHRASE):
${previousList}

Return ONLY the question text, nothing else. No quotes, no prefix.`;

  const stream = await invokeBedrockPrompt(prompt, 128, 0.9);
  const buf = await collectResponseBody(stream);
  const parsed = extractJsonFromResponse(buf);
  const text = (parsed.rawText || '').trim().replace(/^["']|["']$/g, '');
  return text || "What's the one thing you could eat every day and never get tired of?";
}

/** Shuffle an array in place */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Try to extract 3 wrong answers from a model response */
function extractWrongs(parsed: any, realAnswer: string): string[] | null {
  let wrongs: string[] = [];

  // Try structured object
  if (parsed.wrong1 && parsed.wrong2 && parsed.wrong3) {
    wrongs = [parsed.wrong1, parsed.wrong2, parsed.wrong3];
  }

  // Try rawText
  if (wrongs.length === 0 && parsed.rawText) {
    try {
      const obj = JSON.parse(parsed.rawText);
      if (obj.wrong1) wrongs = [obj.wrong1, obj.wrong2, obj.wrong3];
      else if (Array.isArray(obj)) wrongs = obj.filter((s: any) => typeof s === 'string').slice(0, 4);
    } catch { /* try array extraction */ }

    if (wrongs.length === 0) {
      const match = (parsed.rawText as string).match(/\[([^\]]+)\]/);
      if (match) {
        try {
          wrongs = JSON.parse(`[${match[1]}]`).filter((s: any) => typeof s === 'string');
        } catch { /* give up */ }
      }
    }
  }

  // Remove the real answer if AI included it, keep only wrongs
  wrongs = wrongs.filter(w => w && w.toLowerCase().trim() !== realAnswer.toLowerCase().trim());

  return wrongs.length >= 3 ? wrongs.slice(0, 3) : null;
}

/**
 * Generate 4 multiple choice options from the real answer.
 *
 * Pipeline:
 * 1. Sonnet generates 3 wrong answers
 * 2. Haiku validates they're realistic (not generic filler)
 * 3. If validation fails, regenerate with feedback
 */
async function generateChoicesFromAnswer(
  question: string,
  realAnswer: string,
  targetUserName: string,
): Promise<string[]> {
  const genPrompt = `I need exactly 3 wrong answers for a Family Feud game.

Question asked to ${targetUserName}: "${question}"
Their real answer: "${realAnswer}"

Think step by step:
1. What TYPE of thing is "${realAnswer}"? (e.g., a fear, a food, a movie, a place, a person, etc.)
2. Give 3 other realistic things of that EXACT same type that someone might answer.

For example:
- Fear "Plane crashes" → "Spiders", "Heights", "Clowns" (all fears)
- Food "Tacos" → "Pizza", "Sushi", "Burgers" (all foods)
- Movie "Titanic" → "The Godfather", "Forrest Gump", "Star Wars" (all movies)

BANNED: "None of the above", "All of the above", "Something else", "Not X", "The opposite of X", anything meta or referencing the real answer.

Return ONLY: {"wrong1": "...", "wrong2": "...", "wrong3": "..."}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Step 1: Generate with Sonnet
      const genModel = attempt < 2 ? AVAILABLE_MODELS.CLAUDE_SONNET_4 : AVAILABLE_MODELS.CLAUDE_HAIKU_4_5;
      const stream = await invokeBedrockPrompt(genPrompt, 128, 0.7, {}, genModel);
      const buf = await collectResponseBody(stream);
      const parsed = extractJsonFromResponse(buf, genModel);
      const wrongs = extractWrongs(parsed, realAnswer);

      if (!wrongs) {
        logger.warn('Failed to extract wrongs from response', { attempt: attempt + 1 });
        continue;
      }

      // Step 2: Validate with a different model
      const valModel = attempt < 2 ? AVAILABLE_MODELS.CLAUDE_HAIKU_4_5 : AVAILABLE_MODELS.CLAUDE_SONNET_4;
      const valPrompt = `A family trivia game asked: "${question}"
The real answer is: "${realAnswer}"
The proposed wrong choices are: "${wrongs[0]}", "${wrongs[1]}", "${wrongs[2]}"

Check: Are ALL 3 wrong choices realistic, specific answers to the question?
They must be the SAME TYPE of thing as "${realAnswer}" (not generic filler like "none of the above", "something else", "not X", etc.)

Return ONLY: {"valid": true} or {"valid": false, "reason": "why"}`;

      try {
        const valStream = await invokeBedrockPrompt(valPrompt, 64, 0.1, {}, valModel);
        const valBuf = await collectResponseBody(valStream);
        const valParsed = extractJsonFromResponse(valBuf, valModel);

        if (valParsed.valid === false) {
          logger.warn('Choices failed validation, regenerating', {
            attempt: attempt + 1, reason: valParsed.reason, wrongs,
          });
          continue;
        }
      } catch (valErr) {
        // Validation call failed — accept the choices anyway (generation succeeded)
        logger.warn('Validation call failed, accepting choices', {
          error: valErr instanceof Error ? valErr.message : String(valErr),
        });
      }

      // Passed — shuffle real answer in
      const result = shuffle([realAnswer, ...wrongs]);
      logger.info('Family Feud choices generated and validated', {
        realAnswer, wrongs, attempt: attempt + 1,
      });
      return result;
    } catch (err) {
      logger.error('Choice generation attempt failed', {
        attempt: attempt + 1,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Absolute last resort — keyword-based fallback
  logger.error('All choice generation attempts failed', { question, realAnswer });
  const fallbacks: Record<string, string[]> = {
    fear: ['Spiders', 'Heights', 'Public speaking', 'The dark', 'Snakes', 'Flying'],
    food: ['Pizza', 'Sushi', 'Burgers', 'Pasta', 'Tacos', 'Steak'],
    movie: ['The Godfather', 'Titanic', 'Star Wars', 'Forrest Gump', 'Jurassic Park', 'The Lion King'],
    song: ['Bohemian Rhapsody', 'Hotel California', 'Imagine', 'Yesterday', 'Thriller', 'Sweet Caroline'],
    color: ['Red', 'Blue', 'Green', 'Purple', 'Yellow', 'Orange'],
    animal: ['Dog', 'Cat', 'Horse', 'Dolphin', 'Eagle', 'Elephant'],
    place: ['Paris', 'Hawaii', 'New York', 'Tokyo', 'London', 'Rome'],
    hobby: ['Reading', 'Cooking', 'Hiking', 'Gaming', 'Photography', 'Gardening'],
  };
  const qLower = question.toLowerCase();
  const key = Object.keys(fallbacks).find(k => qLower.includes(k)) || '';
  const pool = fallbacks[key] || ['Choice A', 'Choice B', 'Choice C'];
  const wrongs = pool.filter(w => w.toLowerCase() !== realAnswer.toLowerCase()).slice(0, 3);
  while (wrongs.length < 3) wrongs.push(`Alternative ${wrongs.length + 1}`);
  return shuffle([realAnswer, ...wrongs]);
}

/**
 * Check if the current round has expired and needs completion.
 */
async function checkAndCompleteExpiredRound(): Promise<FamilyFeudRound | null> {
  const round = await getCurrentRound();
  if (!round) {
    logger.debug('No current Family Feud round to check');
    return null;
  }

  const now = new Date();
  const expires = new Date(round.expiresAt);

  logger.info('Checking Family Feud round expiry', {
    roundId: round.roundId,
    status: round.status,
    expiresAt: round.expiresAt,
    now: now.toISOString(),
    isExpired: now >= expires,
  });

  if (now >= expires && round.status !== 'completed') {
    logger.info('Family Feud round expired, completing...', { roundId: round.roundId });
    const { ids } = await getAllPeopleIds();
    const rotation = await getRotation(ids);
    const completed = await completeRound(round, rotation);
    logger.info('Family Feud round completed', {
      roundId: completed.roundId,
      winners: completed.results?.winners?.length || 0,
    });
    return completed;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/**
 * GET /family-feud/status
 * Returns current round info, rotation status, and whether it's the user's turn.
 */
export async function familyFeudStatus(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  if (!userId) return errorResponse('Missing userId', 400);

  try {
    // Check for expired round first
    await checkAndCompleteExpiredRound();

    const { ids, names } = await getAllPeopleIds();
    const rotation = await getRotation(ids);
    const round = await getCurrentRound();

    // Anyone can start when there's no active round (first come, first served)
    const isMyTurn = !round;
    const timesAsTarget = getTimesAsTarget(rotation, userId);
    const stats = getRotationStats(rotation);

    // Did I already guess this round?
    const myGuess = round?.guesses?.[userId] || null;

    // Get recent completed rounds for timeline
    const recentRounds = await getRecentRounds(5);

    return successResponse({
      currentRound: round ? {
        roundId: round.roundId,
        targetUserId: round.targetUserId,
        targetUserName: round.targetUserName,
        question: round.question,
        status: round.status,
        startedAt: round.startedAt,
        expiresAt: round.expiresAt,
        guessCount: Object.keys(round.guesses).length,
        // Show who has guessed (names only — not their answers, to keep it secret)
        guessers: Object.values(round.guesses).map((g: any) => ({
          userName: g.userName,
          submittedAt: g.submittedAt,
        })),
        myGuess: myGuess?.guess || null,
        // Choices available when round is active
        choices: round.status === 'active' || round.status === 'completed' ? round.choices : null,
        // Reveal the real answer once the round is complete. Also reveal
        // it to the target during the active phase — they're the one who
        // typed it, so there's nothing to leak — so the UI can highlight
        // which of the 4 AI choices is theirs.
        realAnswer: round.status === 'completed'
          ? round.realAnswer
          : round.status === 'active' && round.targetUserId === userId
            ? round.realAnswer
            : null,
        allGuesses: round.status === 'completed'
          ? Object.values(round.guesses).map((g: any) => ({
              userName: g.userName,
              guess: g.guess,
              correct: round.realAnswer?.toLowerCase().trim() === g.guess?.toLowerCase().trim(),
            }))
          : null,
        results: round.status === 'completed' ? round.results : null,
      } : null,
      isMyTurn,
      timesAsTarget,
      neverGone: stats.neverGone.length,
      totalPeople: stats.totalPeople,
      recentRounds: recentRounds.map(r => ({
        roundId: r.roundId,
        targetUserId: r.targetUserId,
        targetUserName: r.targetUserName,
        question: r.question,
        category: (r as any).category,
        realAnswer: r.realAnswer,
        choices: r.choices,
        status: r.status,
        startedAt: r.startedAt,
        expiresAt: r.expiresAt,
        guessCount: Object.keys(r.guesses).length,
        allGuesses: Object.values(r.guesses).map((g: any) => ({
          userName: g.userName,
          guess: g.guess,
          correct: r.realAnswer?.toLowerCase().trim() === g.guess?.toLowerCase().trim(),
        })),
        results: r.results,
      })),
    });
  } catch (err) {
    logger.error('Error getting Family Feud status', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to get Family Feud status', 500);
  }
}

/**
 * POST /family-feud/start-round
 * Target user accepts their turn — generates question and creates round.
 */
export async function familyFeudStartRound(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId } = body;
  if (!userId) return errorResponse('Missing userId', 400);

  try {
    const { ids, names } = await getAllPeopleIds();

    // Check no active round
    const existing = await getCurrentRound();
    if (existing && existing.status !== 'completed') {
      return errorResponse('A round is already active', 400);
    }

    // Generate a personal question
    const targetName = names[userId] || userId;
    const question = await generateFeudQuestion(targetName);

    const round = await createRound(userId, targetName, question);

    // Notify everyone about the new round (fire-and-forget)
    writeFeudNewRoundNotification(question, targetName).catch(() => { /* silent */ });

    return successResponse({
      round: {
        roundId: round.roundId,
        question: round.question,
        status: round.status,
        expiresAt: round.expiresAt,
      },
    });
  } catch (err) {
    logger.error('Error starting Family Feud round', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to start round', 500);
  }
}

/**
 * POST /family-feud/answer
 * Target user submits their real answer — activates round for guessing.
 */
export async function familyFeudAnswer(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, answer } = body;
  if (!userId || !answer) return errorResponse('Missing userId or answer', 400);

  try {
    const round = await getCurrentRound();
    if (!round) return errorResponse('No active round', 400);
    if (round.targetUserId !== userId) return errorResponse('Not your round', 403);
    if (round.realAnswer) return errorResponse('Already answered', 400);

    // Generate multiple choice options from the real answer using AI
    const choices = await generateChoicesFromAnswer(
      round.question, answer, round.targetUserName,
    );

    const updated = await submitTargetAnswer(round, answer, choices);

    return successResponse({
      round: {
        roundId: updated.roundId,
        status: updated.status,
        expiresAt: updated.expiresAt,
        choices: updated.choices,
      },
    });
  } catch (err) {
    logger.error('Error submitting Family Feud answer', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to submit answer', 500);
  }
}

/**
 * POST /family-feud/guess
 * Family member submits their guess for the current round.
 */
export async function familyFeudGuess(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, guess } = body;
  if (!userId || !guess) return errorResponse('Missing userId or guess', 400);

  try {
    const round = await getCurrentRound();
    if (!round) return errorResponse('No active round', 400);
    if (round.status !== 'active') return errorResponse('Round not accepting guesses', 400);
    if (round.targetUserId === userId) return errorResponse('Cannot guess your own round', 400);

    // Check if round expired
    if (new Date() >= new Date(round.expiresAt)) {
      return errorResponse('Round has expired', 400);
    }

    const { names } = await getAllPeopleIds();
    const updated = await submitGuess(round, userId, names[userId] || userId, guess);

    return successResponse({
      guessCount: Object.keys(updated.guesses).length,
    });
  } catch (err) {
    logger.error('Error submitting Family Feud guess', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to submit guess', 500);
  }
}

/**
 * POST /family-feud/pass
 * Target user passes their turn.
 */
export async function familyFeudPass(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId } = body;
  if (!userId) return errorResponse('Missing userId', 400);

  try {
    const { ids } = await getAllPeopleIds();
    const rotation = await getRotation(ids);

    await passTurn(rotation, userId);

    return successResponse({
      passed: true,
    });
  } catch (err) {
    logger.error('Error passing Family Feud turn', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to pass turn', 500);
  }
}

// ---------------------------------------------------------------------------
// Admin Endpoints
// ---------------------------------------------------------------------------

import { requireAdmin } from '../services/adminAuth';

/**
 * GET /admin/family-feud — get current round + recent rounds for admin view.
 */
export async function adminGetFamilyFeud(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const adminId = event.queryStringParameters?.adminUserId;
  const authErr = await requireAdmin(adminId);
  if (authErr) return errorResponse(authErr, 403);

  const round = await getCurrentRound();
  const recentRounds = await getRecentRounds(20);

  return successResponse({
    currentRound: round,
    recentRounds,
  });
}

/**
 * DELETE /admin/family-feud — reset current round, delete a round, or reset rotation.
 */
export async function adminResetFamilyFeud(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { adminUserId, action, roundId } = body;

  const authErr = await requireAdmin(adminUserId);
  if (authErr) return errorResponse(authErr, 403);

  if (action === 'reset-current') {
    await resetCurrentRound();
    return successResponse({ success: true, action: 'reset-current' });
  } else if (action === 'delete-round' && roundId) {
    await deleteRound(roundId);
    return successResponse({ success: true, action: 'delete-round', roundId });
  } else if (action === 'reset-rotation') {
    await resetRotation();
    return successResponse({ success: true, action: 'reset-rotation' });
  }

  return errorResponse('Invalid action. Use: reset-current, delete-round, reset-rotation', 400);
}
