/**
 * The frame every prompt writes in (docs/decisions/0023): who the people are
 * for this request's circle. Prompts take words from it instead of saying
 * "family", so one prompt serves every kind of circle.
 */
import { type AiFrame, aiFrameFor } from '@family-trivia/shared';
import { currentCircleKind } from '../../circles';

export const circleFrame = async (): Promise<AiFrame> => aiFrameFor(await currentCircleKind());

/**
 * Every prompt goes through here on its way to the model. In a friends or
 * mixed circle it gains one opening line saying who these people are, so a
 * prompt written with a family in mind still reads right. Prompts that matter
 * most also take their words from the frame directly.
 */
export async function framePrompt(prompt: string): Promise<string> {
  let frame: AiFrame;
  try {
    frame = await circleFrame();
  } catch {
    return prompt; // outside any circle (startup checks): nothing to frame
  }
  if (frame.kind === 'family') return prompt;
  return `WHO THIS IS FOR: ${frame.audience}. Wherever the instructions below say "family", read "${frame.group}". ${frame.avoid}

${prompt}`;
}
