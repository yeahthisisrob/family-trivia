/**
 * The older way in: a prompt to a body the response parsers read. It runs on
 * Converse (converse.ts) like everything else and hands back a body shaped as
 * before, so callers move to askText / askStructured one at a time
 * (docs/decisions/0033).
 */
import { MODEL_ID } from '../../../config';
import { askText } from './converse';

export async function invokeBedrockPrompt(
  prompt: string,
  maxTokens = 512,
  temperature = 0.7,
  context: Record<string, unknown> = {},
  overrideModelId?: string,
): Promise<Uint8Array> {
  const text = await askText({
    task: String(context.task ?? 'other'),
    prompt,
    maxTokens,
    temperature,
    model: overrideModelId || MODEL_ID,
  });
  return new TextEncoder().encode(JSON.stringify({ content: [{ type: 'text', text }] }));
}
