/**
 * What the AI actually used: tokens per task and model, kept per month in
 * usage/YYYY-MM.json so Settings can show real spend next to estimates.
 * Calls are tallied in memory and written once at the end of the request.
 */
import type { UsageMonth } from '@family-trivia/shared';
import { logger } from '../../logger';
import { getJson, putJson } from '../../s3';

const pending: { task: string; model: string; input: number; output: number }[] = [];

export const usageKey = (d = new Date()) => `usage/${d.toISOString().slice(0, 7)}.json`;

export function recordUsage(task: string, model: string, input: number, output: number): void {
  pending.push({ task, model, input, output });
}

/** Read the input/output token counts from a Bedrock Claude response body. */
export function usageFromBody(body: Uint8Array): { input: number; output: number } | null {
  try {
    const u = (
      JSON.parse(new TextDecoder().decode(body)) as {
        usage?: { input_tokens?: number; output_tokens?: number };
      }
    ).usage;
    return u ? { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0 } : null;
  } catch {
    return null;
  }
}

export async function flushUsage(): Promise<void> {
  if (!pending.length) return;
  const batch = pending.splice(0);
  try {
    const key = usageKey();
    const month = (await getJson<UsageMonth>(key)) ?? {};
    for (const { task, model, input, output } of batch) {
      month[task] ??= {};
      const byModel = month[task];
      byModel[model] ??= { calls: 0, input: 0, output: 0 };
      const row = byModel[model];
      row.calls++;
      row.input += input;
      row.output += output;
    }
    await putJson(key, month);
  } catch (err) {
    logger.warn('Could not record AI usage', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
