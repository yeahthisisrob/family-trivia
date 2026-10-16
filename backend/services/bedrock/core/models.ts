/**
 * Which model each AI task uses. The family's choices load once per request
 * (loadModelChoices, called by the router), so modelFor(task) is a plain
 * lookup everywhere it's needed. Unset tasks use the built-in writer or fast
 * model (config.ts MODELS).
 */
import { AI_TASKS, type AiTaskId, aiTask } from '@family-trivia/shared';
import { MODELS } from '../../../config';
import { getJson } from '../../s3';

let choices: Record<string, string> = {};

export async function loadModelChoices(): Promise<void> {
  const stored = (await getJson<Record<string, unknown>>('config/settings.json')) ?? {};
  choices = Object.fromEntries(
    AI_TASKS.map((t) => [t.id, stored[`ai.model.${t.id}`]] as const).filter(
      (kv): kv is readonly [AiTaskId, string] => typeof kv[1] === 'string' && kv[1].length > 0,
    ),
  );
}

export function modelFor(task: AiTaskId): string {
  return choices[task] ?? (aiTask(task)?.role === 'fast' ? MODELS.FAST : MODELS.WRITER);
}
