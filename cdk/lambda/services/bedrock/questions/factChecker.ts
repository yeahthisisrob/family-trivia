// Fact checking service for trivia questions
import { invokeBedrockPrompt } from '../core/bedrockClient';
import { collectResponseBody, extractJsonFromResponse } from '../core/responseParser';
import { Question } from '../core/types';
import { logger } from '../../logger';
import { SERVICE_MODELS } from '../../../config';

export interface FactCheckResult {
  isAccurate: boolean;
  confidence: 'high' | 'medium' | 'low';
  explanation?: string;
  suggestedCorrection?: string;
  checkedBy: string;
  difficultyMismatch?: boolean;
  suggestedDifficulty?: 'easy' | 'normal' | 'hard';
}

/**
 * Fact checks a trivia question using a randomly selected model
 */
export async function factCheckQuestion(question: Question, expectedDifficulty?: 'easy' | 'normal' | 'hard'): Promise<FactCheckResult> {
  // Randomly select a fact checker model
  const factCheckers = SERVICE_MODELS.FACT_CHECKERS;
  const selectedModel = factCheckers[Math.floor(Math.random() * factCheckers.length)];
  
  // Determine model name for display
  const modelDisplayName = selectedModel.includes('claude-3-7-sonnet') 
    ? 'Claude 3.7 Sonnet' 
    : selectedModel.includes('llama')
    ? 'Meta Llama 3.3'
    : 'AI Fact Checker';
  
  logger.info('Fact checking question', {
    model: selectedModel,
    modelName: modelDisplayName,
    question: question.question.substring(0, 50) + '...'
  });

  const prompt = buildFactCheckPrompt(question, expectedDifficulty);
  
  try {
    const response = await invokeBedrockPrompt(
      prompt,
      256, // Max tokens - fact check should be concise
      0.1, // Low temperature for accuracy
      { factChecking: true },
      selectedModel
    );
    
    const responseBuffer = await collectResponseBody(response);
    const result = extractJsonFromResponse(responseBuffer, selectedModel);
    
    // Parse the fact check result
    if (typeof result === 'object' && result !== null) {
      return {
        isAccurate: result.isAccurate ?? true,
        confidence: result.confidence ?? 'medium',
        explanation: result.explanation,
        suggestedCorrection: result.suggestedCorrection,
        checkedBy: modelDisplayName,
        difficultyMismatch: result.difficultyMismatch ?? false,
        suggestedDifficulty: result.suggestedDifficulty
      };
    }
    
    // Fallback if response isn't properly formatted
    return {
      isAccurate: true,
      confidence: 'low',
      explanation: 'Could not parse fact check response',
      checkedBy: modelDisplayName
    };
    
  } catch (error) {
    logger.error('Fact checking failed', {
      error,
      model: selectedModel,
      question: question.question
    });
    
    // Default to allowing the question if fact checking fails
    return {
      isAccurate: true,
      confidence: 'low',
      explanation: 'Fact checking unavailable',
      checkedBy: modelDisplayName
    };
  }
}

/**
 * Builds the fact checking prompt
 */
function buildFactCheckPrompt(question: Question, expectedDifficulty?: 'easy' | 'normal' | 'hard'): string {
  const difficultySection = expectedDifficulty ? `
Expected Difficulty: ${expectedDifficulty}

Also verify:
5. Is this question appropriately difficult for the "${expectedDifficulty}" level?
   - Easy: Common knowledge, widely known facts
   - Normal: Requires some general knowledge or reasoning
   - Hard: Requires specialized knowledge or deep thinking` : '';

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
  "suggestedCorrection": "Optional: corrected version if needed"${expectedDifficulty ? `,
  "difficultyMismatch": true/false,
  "suggestedDifficulty": "easy/normal/hard if different from expected"` : ''}
}

Be strict but fair. Only flag clear factual errors${expectedDifficulty ? ' or significant difficulty mismatches' : ''}.`;
}