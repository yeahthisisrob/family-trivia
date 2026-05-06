// File: lambda/services/questionPipeline.ts
// Purpose: Multi-model question generation pipeline.
// Generates candidates from trivia bank + Sonnet + Haiku in parallel,
// deduplicates, judges the best, validates difficulty, and fact-checks.

import { Question, DifficultyLevel, GenerateQuestionOptions } from './bedrock/core/types';
import { invokeBedrockPrompt } from './bedrock/core/bedrockClient';
import { collectResponseBody, extractJsonFromResponse } from './bedrock/core/responseParser';
import { buildTriviaPrompt } from './bedrock/questions/prompts';
import { isDuplicateQuestion } from './bedrock/questions/utils';
import { validateQuestion } from './bedrock/questions/trivia';
import { externalTriviaS3Service } from './externalTriviaS3';
import { getAllQuestionsFlat } from './questionHistoryService';
import { AVAILABLE_MODELS } from '../config';
import { logger } from './logger';

const POINT_MULTIPLIERS: Record<DifficultyLevel, number> = { easy: 0.5, normal: 1, hard: 2 };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PipelineOptions {
  userId: string;
  mode: string;
  category?: string;
  difficulty?: DifficultyLevel;
  customPrompt?: string;
  extraPromptParts?: string[];
}

interface PipelineResult {
  question: Question;
  source: 'trivia-bank' | 'sonnet' | 'haiku' | 'judge-enhanced';
  bedrockCalls: number;
  factChecked: boolean;
}

// ---------------------------------------------------------------------------
// Candidate Generation
// ---------------------------------------------------------------------------

async function getTriviaBankCandidate(
  category: string,
  difficulty: DifficultyLevel,
  history: Question[],
): Promise<Question | null> {
  try {
    const q = await externalTriviaS3Service.getRandomQuestion(category, difficulty);
    if (!q) return null;

    const candidate: Question = {
      question: q.question, choices: q.choices, answer: q.answer,
      category: q.category || category, difficulty,
      pointMultiplier: POINT_MULTIPLIERS[difficulty],
    };

    if (isDuplicateQuestion(candidate, history)) {
      logger.info('Trivia bank question is duplicate', { question: candidate.question.substring(0, 50) });
      return null;
    }
    return candidate;
  } catch (err) {
    logger.debug('Trivia bank lookup failed', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

async function generateWithModel(
  modelId: string,
  prompt: string,
  category: string | undefined,
  difficulty: DifficultyLevel,
  history: Question[],
  temperature = 0.8,
): Promise<{ question: Question | null; calls: number }> {
  try {
    const stream = await invokeBedrockPrompt(prompt, 512, temperature, {}, modelId);
    const buf = await collectResponseBody(stream);
    const parsed = extractJsonFromResponse(buf, modelId);

    if (parsed.rawText || !validateQuestion(parsed)) {
      return { question: null, calls: 1 };
    }

    const q = parsed as Question;
    q.category = category || q.category || 'General';
    q.difficulty = difficulty;
    q.pointMultiplier = POINT_MULTIPLIERS[difficulty];

    if (isDuplicateQuestion(q, history)) {
      logger.info('AI candidate is duplicate', {
        model: modelId.includes('sonnet') ? 'sonnet' : 'haiku',
        question: q.question.substring(0, 50),
      });
      return { question: null, calls: 1 };
    }

    return { question: q, calls: 1 };
  } catch (err) {
    logger.error('Model generation failed', {
      model: modelId, error: err instanceof Error ? err.message : String(err),
    });
    return { question: null, calls: 1 };
  }
}

// ---------------------------------------------------------------------------
// Validation: Difficulty + Fact-Check + Judge (combined)
// ---------------------------------------------------------------------------

/**
 * Judge picks the best candidate, validates difficulty, and fact-checks — all in one call.
 * For single candidates, does fact-check + difficulty validation only.
 */
async function judgeValidateAndFactCheck(
  candidates: Array<{ question: Question; source: string }>,
  category: string | undefined,
  difficulty: DifficultyLevel,
): Promise<{ winner: Question; source: string; calls: number }> {
  if (candidates.length === 0) throw new Error('No candidates to judge');

  const difficultyDescriptions: Record<string, string> = {
    easy: 'Common knowledge that most people would know. Straightforward, no tricks.',
    normal: 'Requires some specific knowledge but still accessible to a general audience.',
    hard: 'Requires detailed or specialized knowledge. Should challenge knowledgeable players.',
  };

  if (candidates.length === 1) {
    // Single candidate — fact-check + difficulty validate
    const q = candidates[0].question;
    const prompt = `You are a trivia game quality checker. Evaluate this ${difficulty} difficulty question:

Question: ${q.question}
Choices: ${q.choices.join(' | ')}
Stated answer: ${q.answer}
Expected difficulty: ${difficulty} — ${difficultyDescriptions[difficulty]}

Check ALL of the following:
1. Is the stated answer factually correct?
2. Is the difficulty appropriate for "${difficulty}" level?
3. Are all 4 choices plausible (no obviously wrong answers)?
4. Is the question clear and unambiguous?

Return ONLY: {
  "isAccurate": true/false,
  "correctAnswer": "<if wrong, the right answer from choices, otherwise null>",
  "difficultyOk": true/false,
  "actualDifficulty": "easy|normal|hard",
  "reason": "<brief explanation if any issue>"
}`;

    try {
      const modelId = AVAILABLE_MODELS.CLAUDE_HAIKU_4_5;
      const stream = await invokeBedrockPrompt(prompt, 256, 0.1, {}, modelId);
      const buf = await collectResponseBody(stream);
      const parsed = extractJsonFromResponse(buf, modelId);

      // Correct wrong answer
      if (parsed.isAccurate === false && parsed.correctAnswer && q.choices.includes(parsed.correctAnswer)) {
        q.answer = parsed.correctAnswer;
        logger.info('Fact-check corrected answer', { corrected: parsed.correctAnswer });
      }

      // Log difficulty mismatch
      if (parsed.difficultyOk === false) {
        logger.warn('Difficulty mismatch detected', {
          expected: difficulty, actual: parsed.actualDifficulty, reason: parsed.reason,
          question: q.question.substring(0, 50),
        });
      }

      return { winner: q, source: candidates[0].source, calls: 1 };
    } catch {
      return { winner: q, source: candidates[0].source, calls: 1 };
    }
  }

  // Multiple candidates — judge picks best + validates + fact-checks in one call
  const prompt = `You are a trivia game judge. Pick the BEST question from these candidates for a ${difficulty} difficulty ${category || 'general'} trivia game.

Difficulty level "${difficulty}": ${difficultyDescriptions[difficulty]}

Criteria (in order of importance):
1. Factually accurate — the stated answer MUST be correct
2. Appropriate difficulty for "${difficulty}" — not too easy, not too hard
3. Interesting and engaging for a family game
4. Clear, unambiguous — exactly one correct answer
5. All 4 choices are plausible

Candidates:
${candidates.map((c, i) => `
OPTION ${i + 1}:
Question: ${c.question.question}
Choices: ${c.question.choices.join(' | ')}
Answer: ${c.question.answer}
`).join('')}

Return ONLY: {
  "bestOption": <number 1-${candidates.length}>,
  "isAccurate": true/false,
  "correctAnswer": "<if inaccurate, the right answer from choices, otherwise null>",
  "difficultyOk": true/false,
  "reason": "<brief reason for your pick>"
}`;

  try {
    const modelId = AVAILABLE_MODELS.CLAUDE_SONNET_4;
    const stream = await invokeBedrockPrompt(prompt, 256, 0.2, {}, modelId);
    const buf = await collectResponseBody(stream);
    const parsed = extractJsonFromResponse(buf, modelId);

    const bestIdx = (parsed.bestOption || 1) - 1;
    const selected = candidates[Math.min(bestIdx, candidates.length - 1)];

    if (parsed.isAccurate === false && parsed.correctAnswer) {
      if (selected.question.choices.includes(parsed.correctAnswer)) {
        selected.question.answer = parsed.correctAnswer;
        logger.info('Judge corrected answer', { corrected: parsed.correctAnswer });
      }
    }

    if (parsed.difficultyOk === false) {
      logger.warn('Judge: difficulty mismatch', {
        expected: difficulty, reason: parsed.reason,
        question: selected.question.question.substring(0, 50),
      });
    }

    logger.info('Judge selected question', {
      selected: bestIdx + 1, source: selected.source,
      isAccurate: parsed.isAccurate, difficultyOk: parsed.difficultyOk,
      reason: parsed.reason,
    });

    return { winner: selected.question, source: selected.source, calls: 1 };
  } catch (err) {
    logger.error('Judge call failed, using first candidate', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { winner: candidates[0].question, source: candidates[0].source, calls: 1 };
  }
}

// ---------------------------------------------------------------------------
// Main Pipeline
// ---------------------------------------------------------------------------

/**
 * Generate the best possible trivia question.
 *
 * Pipeline:
 * 1. Gather candidates in parallel:
 *    - Trivia bank (0 Bedrock calls) — standard categories only
 *    - Sonnet 4 (1 call) — all modes
 *    - Haiku 4.5 (1 call) — all modes including custom
 * 2. Deduplicate all against 500 most recent questions
 * 3. Judge picks best + validates difficulty + fact-checks (1 call)
 * 4. Return best question
 *
 * Total: 2-3 Bedrock calls typical
 */
export async function generateBestQuestion(
  options: PipelineOptions,
): Promise<PipelineResult> {
  const {
    userId,
    mode,
    category,
    difficulty = 'normal',
    customPrompt,
    extraPromptParts = [],
  } = options;

  let totalCalls = 0;

  // Load history for dedup (cached per invocation)
  const history = await getAllQuestionsFlat() as Question[];

  // Build prompt
  const parts = [...extraPromptParts];
  if (customPrompt?.trim()) parts.push(`User instruction: ${customPrompt.trim()}`);
  if (mode === 'category' && category) parts.push(`Category: ${category}`);
  if (mode === 'custom' && category) {
    parts.push(`Custom Category: ${category}`);
    parts.push(`Generate trivia questions about "${category}"`);
  }

  const prompt = buildTriviaPrompt(parts, difficulty);

  // --- Step 1: Gather candidates in parallel ---
  const candidatePromises: Array<Promise<{ question: Question | null; source: string; calls: number }>> = [];

  // Trivia bank (free — no Bedrock call, standard categories only)
  if (mode === 'category' && category && !customPrompt) {
    candidatePromises.push(
      getTriviaBankCandidate(category, difficulty, history)
        .then(q => ({ question: q, source: 'trivia-bank', calls: 0 })),
    );
  }

  // Sonnet 4 — always generate
  candidatePromises.push(
    generateWithModel(AVAILABLE_MODELS.CLAUDE_SONNET_4, prompt, category, difficulty, history)
      .then(r => ({ question: r.question, source: 'sonnet', calls: r.calls })),
  );

  // Haiku 4.5 — generate for ALL modes (including custom, was skipping before)
  candidatePromises.push(
    generateWithModel(AVAILABLE_MODELS.CLAUDE_HAIKU_4_5, prompt, category, difficulty, history)
      .then(r => ({ question: r.question, source: 'haiku', calls: r.calls })),
  );

  const results = await Promise.all(candidatePromises);

  const validCandidates: Array<{ question: Question; source: string }> = [];
  for (const r of results) {
    totalCalls += r.calls;
    if (r.question) validCandidates.push({ question: r.question, source: r.source });
  }

  logger.info('Candidate generation complete', {
    total: results.length, valid: validCandidates.length,
    sources: validCandidates.map(c => c.source), bedrockCalls: totalCalls,
  });

  // --- Step 2: If no valid candidates, retry with higher temp (KEEP history for dedup) ---
  if (validCandidates.length === 0) {
    logger.warn('No valid candidates, retrying with higher temperature');
    const retry = await generateWithModel(
      AVAILABLE_MODELS.CLAUDE_SONNET_4, prompt, category, difficulty,
      history, // FIX: keep history instead of empty array
      0.95,    // Higher temperature for more variety
    );
    totalCalls += retry.calls;

    if (retry.question) {
      // Still fact-check even on retry
      const check = await judgeValidateAndFactCheck(
        [{ question: retry.question, source: 'sonnet' }], category, difficulty,
      );
      totalCalls += check.calls;
      return {
        question: check.winner, source: 'sonnet',
        bedrockCalls: totalCalls, factChecked: true,
      };
    }

    throw new Error('Failed to generate any valid question after retries');
  }

  // --- Step 3: ALWAYS judge + validate difficulty + fact-check (no circuit breaker skip) ---
  const judgeResult = await judgeValidateAndFactCheck(validCandidates, category, difficulty);
  totalCalls += judgeResult.calls;

  logger.info('Question pipeline complete', {
    source: judgeResult.source, bedrockCalls: totalCalls, difficulty,
    question: judgeResult.winner.question.substring(0, 60),
  });

  return {
    question: judgeResult.winner,
    source: (validCandidates.length > 1 ? 'judge-enhanced' : judgeResult.source) as PipelineResult['source'],
    bedrockCalls: totalCalls,
    factChecked: true,
  };
}
