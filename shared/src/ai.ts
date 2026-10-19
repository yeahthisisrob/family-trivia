/**
 * The AI in the app, by task: which Claude model each task uses, what it
 * costs, and how much of it a family tends to use. Admins pick models per
 * task in Settings; the API resolves them with `modelFor(task)`.
 *
 * Prices are Bedrock on-demand list prices in US dollars per million tokens,
 * as of the date below. They're for estimates; the AWS bill is the truth.
 */

export const PRICES_AS_OF = '2026-10';

export interface ModelInfo {
  /** The Bedrock inference profile id. */
  id: string;
  label: string;
  /** How it trades quality for cost and speed. */
  tier: 'fast' | 'balanced' | 'best';
  price: { input: number; output: number };
}

export const MODEL_CATALOG: readonly ModelInfo[] = [
  {
    id: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    label: 'Claude Haiku 4.5',
    tier: 'fast',
    price: { input: 1, output: 5 },
  },
  {
    id: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    label: 'Claude Sonnet 4.5',
    tier: 'balanced',
    price: { input: 3, output: 15 },
  },
  {
    id: 'us.anthropic.claude-opus-4-5-20251101-v1:0',
    label: 'Claude Opus 4.5',
    tier: 'best',
    price: { input: 5, output: 25 },
  },
  {
    id: 'us.anthropic.claude-haiku-5-5',
    label: 'Claude Haiku 5.5',
    tier: 'fast',
    price: { input: 1, output: 5 },
  },
  {
    id: 'us.anthropic.claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5',
    tier: 'balanced',
    price: { input: 3, output: 15 },
  },
  {
    id: 'us.anthropic.claude-opus-5-5',
    label: 'Claude Opus 5.5',
    tier: 'best',
    price: { input: 5, output: 25 },
  },
];

export const modelInfo = (id: string): ModelInfo | undefined =>
  MODEL_CATALOG.find((m) => m.id === id);

/** Which built-in model a task uses when no admin has picked one. */
export type ModelRole = 'writer' | 'fast';

export interface AiTask {
  id: string;
  label: string;
  description: string;
  role: ModelRole;
  /**
   * A rough usage profile for estimates: calls per playing person per active
   * day, and tokens in and out per call.
   */
  usage: { callsPerPersonPerDay: number; inputTokens: number; outputTokens: number };
}

export const AI_TASKS = [
  {
    id: 'trivia',
    label: 'Trivia questions',
    description: 'Writes the daily trivia question for each person.',
    role: 'writer',
    usage: { callsPerPersonPerDay: 1.5, inputTokens: 2500, outputTokens: 500 },
  },
  {
    id: 'factCheck',
    label: 'Fact checking',
    description: 'Double-checks each trivia question before anyone sees it.',
    role: 'fast',
    usage: { callsPerPersonPerDay: 1.5, inputTokens: 800, outputTokens: 200 },
  },
  {
    id: 'familyQuestions',
    label: 'Family questions',
    description: 'Writes the daily question about each other and the family.',
    role: 'writer',
    usage: { callsPerPersonPerDay: 0.3, inputTokens: 3000, outputTokens: 400 },
  },
  {
    id: 'spotlight',
    label: 'Spotlights',
    description: 'Writes each person’s spotlight summary and insights.',
    role: 'writer',
    usage: { callsPerPersonPerDay: 0.15, inputTokens: 6000, outputTokens: 900 },
  },
  {
    id: 'roast',
    label: 'Roasts',
    description: 'Writes the playful roast version of a spotlight.',
    role: 'fast',
    usage: { callsPerPersonPerDay: 0.1, inputTokens: 6000, outputTokens: 700 },
  },
  {
    id: 'feud',
    label: 'Family Feud',
    description: 'Writes Family Feud rounds about a family member.',
    role: 'writer',
    usage: { callsPerPersonPerDay: 0.05, inputTokens: 2000, outputTokens: 300 },
  },
  {
    id: 'summaries',
    label: 'Weekly summaries',
    description: 'Sums up the week’s family answers.',
    role: 'writer',
    usage: { callsPerPersonPerDay: 0.02, inputTokens: 8000, outputTokens: 1000 },
  },
  {
    id: 'familyStory',
    label: 'Family story',
    description: 'Writes the short story of the family at the top of the Family tab.',
    role: 'writer',
    usage: { callsPerPersonPerDay: 0.005, inputTokens: 9000, outputTokens: 700 },
  },
  {
    id: 'knowledge',
    label: 'Knowledge index',
    description:
      'Reads new answers and notes what each person talks about: places, food, people, things they love.',
    role: 'fast',
    usage: { callsPerPersonPerDay: 0.05, inputTokens: 4000, outputTokens: 1200 },
  },
  {
    id: 'persona',
    label: 'Personas',
    description: 'A few sentences on who each person is, written from their index when it grows.',
    role: 'writer',
    usage: { callsPerPersonPerDay: 0.02, inputTokens: 2500, outputTokens: 300 },
  },
  {
    id: 'notes',
    label: 'Notes on what you love',
    description:
      'A short “did you know” about the bands, places and things each person loves most, written once and kept.',
    role: 'writer',
    usage: { callsPerPersonPerDay: 0.02, inputTokens: 600, outputTokens: 400 },
  },
  {
    id: 'book',
    label: 'Season books',
    description:
      'Writes the foreword and the few lines that open each month of a season’s book. Once per season and tone; the book is kept.',
    role: 'writer',
    usage: { callsPerPersonPerDay: 0.001, inputTokens: 12000, outputTokens: 1500 },
  },
  {
    id: 'gameMoves',
    label: 'Game opponents',
    description: 'Plays against you in arcade games.',
    role: 'fast',
    usage: { callsPerPersonPerDay: 0.5, inputTokens: 600, outputTokens: 100 },
  },
] as const satisfies readonly AiTask[];

export type AiTaskId = (typeof AI_TASKS)[number]['id'];

export const aiTask = (id: string): AiTask | undefined => AI_TASKS.find((t) => t.id === id);

/** Dollars for a number of tokens on a model. */
export const costOf = (model: ModelInfo | undefined, input: number, output: number): number =>
  model ? (input * model.price.input + output * model.price.output) / 1_000_000 : 0;

/** Estimated dollars a month for one task, for a family of `players` playing on `activeDays`. */
export function estimateMonthly(
  task: AiTask,
  model: ModelInfo | undefined,
  players: number,
  activeDays = 30,
): number {
  const calls = task.usage.callsPerPersonPerDay * players * activeDays;
  return costOf(model, calls * task.usage.inputTokens, calls * task.usage.outputTokens);
}

/** Usage the API records per month (usage/YYYY-MM.json), keyed by task then model. */
export type UsageMonth = Record<
  string,
  Record<string, { calls: number; input: number; output: number }>
>;
