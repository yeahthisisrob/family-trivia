import {
  type HistoryEntry,
  CustomCategory as SharedCustomCategory,
  DifficultyLevel as SharedDifficultyLevel,
  GenerateMode as SharedGenerateMode,
  GenerateQuestionOptions as SharedGenerateQuestionOptions,
  Question as SharedQuestion,
} from '@family-trivia/shared';

export {
  SharedCustomCategory as CustomCategory,
  SharedDifficultyLevel as DifficultyLevel,
  SharedGenerateMode as GenerateMode,
  SharedGenerateQuestionOptions as GenerateQuestionOptions,
  SharedQuestion as Question,
};

/**
 * QuestionHistory is the same as HistoryEntry from shared.
 * Kept as an alias for backwards compatibility within bedrock services.
 */
export type QuestionHistory = HistoryEntry;

// Add this to your existing BedrockClient class or create it if needed
export interface BedrockTextGenerationOptions {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  userId: string;
  format?: 'text' | 'json';
  customPrompt?: string;
}

export interface BedrockTextGenerationResponse {
  text: string;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
