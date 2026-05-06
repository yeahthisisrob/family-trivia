// File: services/bedrock/index.ts
// Purpose: Main entry point for Bedrock-based question generation services

// Re-export core types for external use
export * from './core/types';

// Export question generation functionality
export { generateQuestion } from './questions/trivia';
export { generateUniqueQuestion } from './questions/personal';
export { generateFunFact } from './questions/funFact';
export { generateCustomCategory } from './questions/customCategory';
export { generateGroupDescription } from './groups/suggestDescription';
export { generateMemberSummary } from './members/memberSummary';

// Export enhanced question generation with progress
export { generateQuestionWithProgress, generateQuestionStream } from './questions/triviaWithProgress';
export type { ProgressMessage, QuestionWithProgress } from './questions/triviaWithProgress';

// Export slot machine utilities
export { generateMultipleChoiceFromFact } from './questions/utils';

// Export validation utilities
export { validateQuestion } from './questions/trivia';
export { isDuplicateQuestion, isDuplicateQuestionString } from './questions/utils';