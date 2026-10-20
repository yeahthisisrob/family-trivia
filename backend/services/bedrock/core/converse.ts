/**
 * The one way to talk to a model (docs/decisions/0033): Bedrock's Converse
 * API, the same request shape for every model.
 *
 * - askText: a prompt in, the model's words out.
 * - askStructured: the answer as data. The model must call one tool whose
 *   input is the JSON schema, so there's no JSON to find in prose; the result
 *   is checked by the caller's type guard, and a wrong shape is asked for
 *   once more with what was wrong, then refused. Model output is untrusted.
 *
 * A long, stable system prompt is cached (cachePoint) where the model allows
 * it. Every call logs one line (task, model, tokens, stop reason, time) and
 * adds its tokens to the month's usage (usage.ts). Throttling is the SDK's:
 * adaptive retries with backoff, no guessing here.
 */
import {
  BedrockRuntimeClient,
  type ContentBlock,
  ConverseCommand,
  type ConverseCommandOutput,
  type SystemContentBlock,
  type Tool,
} from '@aws-sdk/client-bedrock-runtime';
import { modelInfo } from '@family-trivia/shared';
import { MODEL_ID, REGION } from '../../../config';
import { logger } from '../../logger';
import { framePrompt } from './frame';
import { recordUsage } from './usage';

let client: BedrockRuntimeClient | null = null;
const bedrock = () => {
  client ??= new BedrockRuntimeClient({ region: REGION, maxAttempts: 5, retryMode: 'adaptive' });
  return client;
};

/** Below this a system prompt is too short for Bedrock to cache, so no cache point. */
const CACHE_MIN_CHARS = 4_000;

export interface Ask {
  /** The AI task, for usage and logs (shared/src/ai.ts AI_TASKS), or a short name. */
  task: string;
  prompt: string;
  /** Standing instructions, kept apart from the prompt so they can be cached. */
  system?: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}

const supports = (model: string) => {
  const info = modelInfo(model);
  // Models outside the catalog (a deployment's own choice): no extras assumed.
  return { cache: info?.promptCache ?? false, forcedTool: info?.forcedTool ?? false };
};

async function converse(
  ask: Ask,
  tool?: { spec: Tool; name: string },
  retry?: ContentBlock[],
): Promise<ConverseCommandOutput> {
  const model = ask.model ?? MODEL_ID;
  const can = supports(model);
  const prompt = await framePrompt(ask.prompt);
  const system: SystemContentBlock[] | undefined = ask.system
    ? [
        { text: ask.system },
        ...(can.cache && ask.system.length >= CACHE_MIN_CHARS
          ? [{ cachePoint: { type: 'default' as const } }]
          : []),
      ]
    : undefined;
  const started = Date.now();
  const out = await bedrock().send(
    new ConverseCommand({
      modelId: model,
      system,
      messages: [
        { role: 'user', content: [{ text: prompt }] },
        ...(retry
          ? [
              { role: 'assistant' as const, content: retry.slice(0, 1) },
              { role: 'user' as const, content: retry.slice(1) },
            ]
          : []),
      ],
      inferenceConfig: { maxTokens: ask.maxTokens ?? 1024, temperature: ask.temperature ?? 0.7 },
      ...(tool && {
        toolConfig: {
          tools: [tool.spec],
          toolChoice: can.forcedTool ? { tool: { name: tool.name } } : { any: {} },
        },
      }),
    }),
  );
  const u = out.usage;
  const input =
    (u?.inputTokens ?? 0) + (u?.cacheReadInputTokens ?? 0) + (u?.cacheWriteInputTokens ?? 0);
  recordUsage(ask.task, model, input, u?.outputTokens ?? 0);
  logger.info('AI call', {
    task: ask.task,
    model,
    inputTokens: u?.inputTokens,
    cachedTokens: u?.cacheReadInputTokens || undefined,
    outputTokens: u?.outputTokens,
    stopReason: out.stopReason,
    ms: Date.now() - started,
  });
  return out;
}

const textOf = (out: ConverseCommandOutput) =>
  (out.output?.message?.content ?? [])
    .map((b) => b.text ?? '')
    .join('')
    .trim();

/** The model's words for a prompt. */
export async function askText(ask: Ask): Promise<string> {
  return textOf(await converse(ask));
}

/** Thrown when a model's structured answer still isn't the right shape after one retry. */
export class AiOutputInvalid extends Error {
  constructor(
    readonly task: string,
    readonly problem: string,
  ) {
    super(`The AI's answer for ${task} wasn't usable: ${problem}`);
    this.name = 'AiOutputInvalid';
  }
}

export interface Structured<T> extends Ask {
  /** The tool's name and what it's for, as the model sees them. */
  name: string;
  description: string;
  /** JSON Schema for the answer: an object. */
  schema: Record<string, unknown>;
  /** The caller's own check of the answer's shape (a type guard). */
  check: (value: unknown) => value is T;
  /** Why a value fails the check, for the retry (optional; a generic line otherwise). */
  why?: (value: unknown) => string;
}

/** The answer as data: the model fills in the schema, and the caller's check decides. */
export async function askStructured<T>(ask: Structured<T>): Promise<T> {
  const spec: Tool = {
    toolSpec: {
      name: ask.name,
      description: ask.description,
      inputSchema: { json: ask.schema as never },
    },
  };
  const tool = { spec, name: ask.name };
  const used = (out: ConverseCommandOutput) =>
    (out.output?.message?.content ?? []).find((b) => b.toolUse?.name === ask.name)?.toolUse;

  const first = await converse(ask, tool);
  const call = used(first);
  if (call && ask.check(call.input)) return call.input;

  const problem = !call
    ? 'it answered in words instead of using the tool'
    : (ask.why?.(call.input) ?? 'it did not match the schema');
  logger.warn('AI answer not usable, asking once more', { task: ask.task, problem });
  const again = call
    ? await converse(ask, tool, [
        { toolUse: call },
        {
          toolResult: {
            toolUseId: call.toolUseId,
            status: 'error',
            content: [
              {
                text: `That wasn't usable: ${problem}. Call ${ask.name} again with a corrected answer.`,
              },
            ],
          },
        },
      ])
    : await converse(
        { ...ask, prompt: `${ask.prompt}\n\nAnswer only by calling the ${ask.name} tool.` },
        tool,
      );
  const second = used(again);
  if (second && ask.check(second.input)) return second.input;
  throw new AiOutputInvalid(
    ask.task,
    second ? (ask.why?.(second.input) ?? 'it did not match the schema') : 'no tool call',
  );
}

/**
 * The answer, or `fallback` when it was refused as the wrong shape, for
 * callers that carry on without one. Any other error still throws.
 */
export function unlessInvalid<T, F>(answer: Promise<T>, fallback: F): Promise<T | F> {
  return answer.catch((err: unknown) => {
    if (err instanceof AiOutputInvalid) return fallback;
    throw err;
  });
}

/** For tests: talk to a stand-in instead of Bedrock. */
export const setBedrockClient = (c: BedrockRuntimeClient | null) => {
  client = c;
};
