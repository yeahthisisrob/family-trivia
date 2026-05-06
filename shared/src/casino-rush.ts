import { DifficultyLevel, Question, ProgressMessage } from './question';

/** Active Casino Rush session as seen by the frontend */
export interface CasinoRushSession {
  currentQuestion: Question & {
    questionNumber: number;
    totalQuestions: number;
    timeLimit: number;
  };
  difficulty: DifficultyLevel;
  potentialPoints: number;
  messages?: ProgressMessage[];
}

/** Internal Casino Rush session stored in S3 (backend) */
export interface CasinoRushInternalSession {
  userId: string;
  startTime: number;
  questions: Array<{
    question: string;
    choices: string[];
    answer: string;
    category: string;
    difficulty: DifficultyLevel;
    startedAt?: number;
    answeredAt?: number;
    userAnswer?: string;
    correct?: boolean;
  }>;
  currentQuestionIndex: number;
  difficulty: DifficultyLevel;
  status: 'active' | 'completed' | 'failed';
  potentialPoints: number;
  lastPlayedAt?: number;
  progressMessages?: ProgressMessage[];
}

/** Result of Casino Rush answer submission */
export interface CasinoRushResult {
  correct: boolean;
  correctAnswer?: string;
  earnedPoints: number;
  gameOver: boolean;
  complete?: boolean;
  message?: string;
  reason?: 'time_expired' | 'wrong_answer';
  nextQuestion?: Question & {
    questionNumber: number;
    totalQuestions: number;
    timeLimit: number;
  };
}

/** Casino Rush play availability */
export interface CasinoRushStatus {
  canPlay: boolean;
  nextAvailable?: Date;
  activeSession?: {
    currentQuestionIndex: number;
    totalQuestions: number;
    difficulty: string;
    potentialPoints: number;
  };
}

/** Casino Rush history entry for cooldown tracking */
export interface CasinoRushHistoryEntry {
  sessionId: string;
  timestamp: number;
  difficulty: DifficultyLevel;
  correct: number;
  total: number;
  pointsEarned: number;
}
