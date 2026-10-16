// File: services/bedrock/index.ts
// Purpose: Main entry point for Bedrock-based question generation services

// Re-export core types for external use
export * from './core/types';
export { generateGroupDescription } from './groups/suggestDescription';
export { generateMemberSummary } from './members/memberSummary';
export { generateCustomCategory } from './questions/customCategory';
export { generateFunFact } from './questions/funFact';
export { generateUniqueQuestion } from './questions/personal';
// Export question generation functionality
// Export validation utilities
export { generateQuestion, validateQuestion } from './questions/trivia';
export type { ProgressMessage, QuestionWithProgress } from './questions/triviaWithProgress';
// Export enhanced question generation with progress
export {
  generateQuestionStream,
  generateQuestionWithProgress,
} from './questions/triviaWithProgress';
// Export slot machine utilities
export {
  generateMultipleChoiceFromFact,
  isDuplicateQuestion,
  isDuplicateQuestionString,
} from './questions/utils';
