/**
 * Step Pipeline Types — shared between frontend and backend
 * for the 3-step question generation pipeline.
 */

import type { Question, DifficultyLevel, GenerateMode, FactCheckResult } from './question';

// ── Step 1: Generate ──────────────────────────────────────────────

export interface Step1Request {
  userId: string;
  mode: GenerateMode;
  category?: string;
  difficulty?: DifficultyLevel;
  isCatchingUp?: boolean;
  /** Topics to avoid on retry (populated from step2 matches) */
  excludedTopics?: string[];
}

export interface Step1Response {
  question: Question;
  sessionId: string;
  generatedAt: number;
  source: string;
  bedrockCalls: number;
}

// ── Step 2: Check Duplicates ──────────────────────────────────────

export interface Step2Request {
  userId: string;
  sessionId: string;
  question: Question;
}

export interface SimilarQuestion {
  question: string;
  similarity: number;
  matchMethod: string;
}

export interface Step2Response {
  isDuplicate: boolean;
  matchMethod?: string;
  matchedTopics?: string[];
  similarQuestions?: SimilarQuestion[];
  sessionId: string;
  checkedAt: number;
  /** Pass-through for step 3 */
  question: Question;
}

// ── Step 3: Fact Check ────────────────────────────────────────────

export interface Step3Request {
  userId: string;
  sessionId: string;
  question: Question;
  skipFactCheck?: boolean;
}

export interface Step3Response {
  question: Question;
  factCheckResult?: FactCheckResult;
  sessionId: string;
  completedAt: number;
  /** True if accurate or fact-check was skipped — safe to present */
  ready: boolean;
}

// ── Progress Callback ─────────────────────────────────────────────

export type StepProgressPhase =
  | 'generating'
  | 'checking-duplicates'
  | 'fact-checking'
  | 'retrying'
  | 'complete'
  | 'error';

export interface StepProgress {
  step: StepProgressPhase;
  message: string;
  attempt?: number;
}
