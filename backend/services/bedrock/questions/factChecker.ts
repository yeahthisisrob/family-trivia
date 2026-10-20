import { modelFor } from '../core/models';
// Fact checking service for trivia questions

import { logger } from '../../logger';
import { AiOutputInvalid, askStructured } from '../core/converse';
import { isRecord } from '../core/shape';
import type { Question } from '../core/types';

export interface FactCheckResult {
  isAccurate: boolean;
  confidence: 'high' | 'medium' | 'low';
  explanation?: string;
  suggestedCorrection?: string;
  checkedBy: string;
  difficultyMismatch?: boolean;
  suggestedDifficulty?: 'easy' | 'normal' | 'hard';
}

type Verdict = Omit<FactCheckResult, 'checkedBy' | 'confidence'> & {
  confidence?: FactCheckResult['confidence'];
};

const LEVELS = ['easy', 'normal', 'hard'];
const CONFIDENCE = ['high', 'medium', 'low'];

const FACT_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    isAccurate: { type: 'boolean' },
    confidence: { type: 'string', enum: CONFIDENCE },
    explanation: { type: 'string' },
    suggestedCorrection: { type: 'string' },
    difficultyMismatch: { type: 'boolean' },
    suggestedDifficulty: { type: 'string', enum: LEVELS },
  },
  required: ['isAccurate', 'confidence'],
};

const optional = (v: unknown, ok: (x: unknown) => boolean) => v === undefined || ok(v);
const isString = (x: unknown) => typeof x === 'string';

/** A fact-check verdict: accuracy as a boolean, and any other field the right type. */
export const isFactCheck = (v: unknown): v is Verdict =>
  isRecord(v) &&
  typeof v.isAccurate === 'boolean' &&
  optional(v.confidence, (x) => CONFIDENCE.includes(x as string)) &&
  optional(v.explanation, isString) &&
  optional(v.suggestedCorrection, isString) &&
  optional(v.difficultyMismatch, (x) => typeof x === 'boolean') &&
  optional(v.suggestedDifficulty, (x) => LEVELS.includes(x as string));

/**
 * Fact checks a trivia question using a randomly selected model
 */
export async function factCheckQuestion(
  question: Question,
  expectedDifficulty?: 'easy' | 'normal' | 'hard',
): Promise<FactCheckResult> {
  // Randomly select a fact checker model
  const selectedModel = modelFor('factCheck');

  // Determine model name for display
  const modelDisplayName = 'AI fact checker';

  logger.info('Fact checking question', {
    model: selectedModel,
    modelName: modelDisplayName,
    question: `${question.question.substring(0, 50)}...`,
  });

  const prompt = buildFactCheckPrompt(question, expectedDifficulty);

  try {
    const result = await askStructured({
      task: 'factCheck',
      prompt,
      maxTokens: 256, // fact check should be concise
      temperature: 0.1, // Low temperature for accuracy
      model: selectedModel,
      name: 'fact_check',
      description: 'Whether the question is accurate, how sure, and what to correct.',
      schema: FACT_CHECK_SCHEMA,
      check: isFactCheck,
    });
    return {
      isAccurate: result.isAccurate,
      confidence: result.confidence ?? 'medium',
      explanation: result.explanation,
      suggestedCorrection: result.suggestedCorrection,
      checkedBy: modelDisplayName,
      difficultyMismatch: result.difficultyMismatch ?? false,
      suggestedDifficulty: result.suggestedDifficulty,
    };
  } catch (error) {
    if (error instanceof AiOutputInvalid) {
      // Fallback if response isn't properly formatted
      return {
        isAccurate: true,
        confidence: 'low',
        explanation: 'Could not parse fact check response',
        checkedBy: modelDisplayName,
      };
    }
    logger.error('Fact checking failed', {
      error,
      model: selectedModel,
      question: question.question,
    });

    // Default to allowing the question if fact checking fails
    return {
      isAccurate: true,
      confidence: 'low',
      explanation: 'Fact checking unavailable',
      checkedBy: modelDisplayName,
    };
  }
}

/**
 * Builds the fact checking prompt
 */
function buildFactCheckPrompt(
  question: Question,
  expectedDifficulty?: 'easy' | 'normal' | 'hard',
): string {
  const difficultySection = expectedDifficulty
    ? `
Expected Difficulty: ${expectedDifficulty}

Also verify:
5. Is this question appropriately difficult for the "${expectedDifficulty}" level?
   - Easy: Common knowledge, widely known facts
   - Normal: Requires some general knowledge or reasoning
   - Hard: Requires specialized knowledge or deep thinking`
    : '';

  return `You are a fact-checking assistant. Analyze this trivia question for factual accuracy${expectedDifficulty ? ' and difficulty appropriateness' : ''}.

Question: "${question.question}"
Options: ${question.choices.join(', ')}
Claimed Answer: ${question.answer}
Category: ${question.category}${difficultySection}

Verify:
1. Is the question factually accurate?
2. Is the provided answer correct?
3. Are all the options plausible?
4. Is the question appropriate for a family trivia game?

Respond in JSON format:
{
  "isAccurate": true/false,
  "confidence": "high/medium/low",
  "explanation": "Brief explanation if there's an issue",
  "suggestedCorrection": "Optional: corrected version if needed"${
    expectedDifficulty
      ? `,
  "difficultyMismatch": true/false,
  "suggestedDifficulty": "easy/normal/hard if different from expected"`
      : ''
  }
}

Be strict but fair. Only flag clear factual errors${expectedDifficulty ? ' or significant difficulty mismatches' : ''}.`;
}
