/** Difficulty levels for generated questions */
export type DifficultyLevel = 'easy' | 'normal' | 'hard';

/** Valid modes for AI-backed question generation */
export type GenerateMode = 'personal' | 'history' | 'group' | 'category' | 'custom';

/** A trivia question with optional difficulty & point multiplier metadata */
export interface Question {
  question: string;
  choices: string[];
  answer: string;
  category?: string;
  difficulty?: DifficultyLevel;
  pointMultiplier?: number;
  mode?: string;
  type?: string;
  source?: string;
  sourceUrl?: string;
  externalId?: string;
}

/** Progress message for enhanced question generation */
export interface ProgressMessage {
  type: 'info' | 'warning' | 'success' | 'checking';
  message: string;
  timestamp: number;
  detail?: string;
  duration?: number;
}

/** Fact check result */
export interface FactCheckResult {
  isAccurate: boolean;
  confidence: number;
  explanation?: string;
  checkedBy: string;
}

/** Enhanced question response with progress messages */
export interface QuestionWithProgress {
  question: Question;
  messages: ProgressMessage[];
  factCheckResult?: FactCheckResult;
  retriesNeeded: number;
}

/** Represents a user's status regarding catchup questions */
export interface CatchupStatus {
  questionsBehind: number;
  userAnswerCount: number;
  /** Total questions available in the season (= days in season) */
  maxQuestionsAvailable: number;
}

/** Represents a user's question timing status */
export interface QuestionStatus {
  lastQuestionAt: string | null;
  nextQuestionAt: string;
}

/** Represents the availability of a question for a user */
export interface QuestionAvailability {
  canAnswer: boolean;
  nextQuestionAt: string;
  todayET: string;
}

/** Options for backend question generation */
export interface GenerateQuestionOptions {
  mode: GenerateMode;
  category?: string;
  customPrompt?: string;
  difficulty?: DifficultyLevel;
  previousQuestions?: Question[];
  excludedQuestions?: string[];
}
