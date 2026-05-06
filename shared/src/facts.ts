/** Daily fact question structure */
export interface DailyFactQuestion {
  question: string;
  answered: boolean;
  fact?: string;
  questionType?: 'basic' | 'shared';
  questionIndex?: number;
  needsBasicCatchup?: boolean;
  isShared?: boolean;
  isFirstPerson?: boolean;
  catchupMode?: boolean;
  basicQuestionsTotal?: number;
  basicQuestionsCompleted?: number;
  daysRemaining?: number;
  weekStartDate?: string;
  date?: string;
}

/** Result of fact submission */
export interface DailyFactResult {
  success: boolean;
  fact: string;
  skipped?: boolean;
  needsBasicCatchup?: boolean;
  basicQuestionsTotal?: number;
  basicQuestionsCompleted?: number;
  isFirstPersonSkip?: boolean;
}

/** Daily/weekly fact summary */
export interface DailyFactSummary {
  date?: string;
  weekStartDate?: string;
  weekEndDate?: string;
  summary: string;
  lastUpdated: string;
  totalResponses: number;
  robSideResponses: number;
  blairSideResponses: number;
  factType: 'personal' | 'shared' | 'mixed';
  totalQuestions?: number;
  uniqueParticipants?: number;
  participationRate?: number;
  isNewlyGenerated?: boolean;
  dailyBreakdown?: {
    [date: string]: {
      responses: number;
      question?: string;
      questionType: 'basic' | 'shared';
    };
  };
}

/** Recent shared question */
export interface RecentQuestion {
  question: string;
  date: string;
  timestamp?: string;
  theme?: string;
  answeredCount?: number;
}

/** Question option for selection */
export interface QuestionOption {
  id: string;
  question: string;
  theme?: string;
}

/** Options response */
export interface GenerateOptionsResponse {
  options: QuestionOption[];
  weekSummaryContext?: string;
}

/** Historical daily fact item */
export interface FactHistoryItem {
  question: string;
  answer?: string;
  fact?: string;
  timestamp: string;
  answered: boolean;
  skipped?: boolean;
  questionType: 'basic' | 'shared';
  questionIndex?: number;
  date?: string;
  theme?: string;
  isGlobal?: boolean;
  historicalUpdate?: boolean;
}

/** User's fact history */
export interface UserFactHistory {
  history: FactHistoryItem[];
  basicQuestions: string[];
  basicQuestionsTotal: number;
  allSharedQuestions: FactHistoryItem[];
}

/** Consolidated fact answer entry (new single-file-per-user model) */
export interface FactAnswerEntry {
  /** Which shared question date this answers (YYYY-MM-DD) */
  date: string;
  question: string;
  answer: string;
  fact: string;
  answered: boolean;
  skipped: boolean;
  /** When the user answered/skipped */
  timestamp: string;
  questionType: 'shared' | 'basic';
  questionIndex?: number;
}
