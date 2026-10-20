// Fun facts after an answer: one short "did you know", in words.
import { topItems } from '@family-trivia/shared';
import { readKnowledge } from '../../knowledge';
import { logger } from '../../logger';
import { askText } from '../core/converse';
import { modelFor } from '../core/models';
import { buildFunFactPrompt } from './prompts';

/**
 * Generate a single short, fun fact based on the user's last answer
 */
export async function generateFunFact(
  userId: string,
  question: string,
  answer: string,
): Promise<string> {
  const loves = topItems(await readKnowledge(userId), 6)
    .filter((t) => t.kind !== 'person')
    .map((t) => t.name);
  const prompt = buildFunFactPrompt(question, answer, loves);

  try {
    const fact = await askText({
      task: 'familyQuestions',
      prompt,
      maxTokens: 512,
      model: modelFor('familyQuestions'),
    });
    return fact || "That's a neat answer!";
  } catch (error) {
    logger.error('Error generating fun fact', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      question: question.substring(0, 100),
    });
    return "That's a neat answer!";
  }
}
