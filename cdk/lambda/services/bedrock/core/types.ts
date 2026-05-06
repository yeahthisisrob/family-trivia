import { Question as SharedQuestion, HistoryEntry, GenerateMode as SharedGenerateMode, DifficultyLevel as SharedDifficultyLevel, GenerateQuestionOptions as SharedGenerateQuestionOptions, CustomCategory as SharedCustomCategory } from '@family-trivia/shared';

export { SharedQuestion as Question, SharedGenerateMode as GenerateMode, SharedDifficultyLevel as DifficultyLevel, SharedGenerateQuestionOptions as GenerateQuestionOptions, SharedCustomCategory as CustomCategory };

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
