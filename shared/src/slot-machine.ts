/** Spin result with multiplier */
export interface SlotMachineResult {
  multiplier: number;
  category: string;
  isPersonalQuestion: boolean;
  targetUserName?: string;
}

/** Question for slot machine */
export interface SlotMachineQuestion {
  question: string;
  choices: string[];
  category: string;
  isPersonal?: boolean;
}

/** Slot machine availability */
export interface SlotMachineStatus {
  canPlay: boolean;
  nextAvailable?: string;
  activeSession?: {
    hasActiveSession: boolean;
    hasQuestion: boolean;
  };
}

/** Answer result */
export interface SlotMachineAnswerResult {
  correct: boolean;
  correctAnswer?: string;
  pointsEarned: number;
  multiplier: number;
}
