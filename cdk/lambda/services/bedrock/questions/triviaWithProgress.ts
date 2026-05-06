// Enhanced trivia generation with progress messages and fact checking
import { Question, GenerateQuestionOptions } from '../core/types';
import { generateQuestion as generateQuestionCore } from './trivia';
import { factCheckQuestion, FactCheckResult } from './factChecker';
import { isDuplicateQuestion, getPreviousCustomCategoryQuestions } from './utils';
import { logger } from '../../logger';
import { getAllQuestionsFlat } from '../../questionHistoryService';

export interface ProgressMessage {
  type: 'info' | 'warning' | 'success' | 'checking';
  message: string;
  timestamp: number;
  detail?: string;
}

export interface QuestionWithProgress {
  question: Question;
  messages: ProgressMessage[];
  factCheckResult?: FactCheckResult;
  retriesNeeded: number;
}

/**
 * Generate a trivia question with progress messages and fact checking
 */
export async function generateQuestionWithProgress(
  userId: string,
  opts: GenerateQuestionOptions
): Promise<QuestionWithProgress> {
  const messages: ProgressMessage[] = [];
  let retriesNeeded = 0;
  let enhancedOpts = opts;
  
  // Start message
  const isCustomCategory = opts.mode === 'custom' || (opts.category && opts.category.includes('Custom:'));
  
  if (!isCustomCategory && opts.mode === 'category') {
    messages.push({
      type: 'info',
      message: `Searching question bank for ${opts.category}...`,
      timestamp: Date.now(),
      detail: `Difficulty: ${opts.difficulty || 'normal'}`
    });
  } else {
    messages.push({
      type: 'info',
      message: `Generating your question in ${opts.category || opts.mode}...`,
      timestamp: Date.now()
    });
  }
  
  try {
    // For custom categories, enhance the options with previous questions
    if (isCustomCategory && opts.category) {
      const previousCustomQuestions = await getPreviousCustomCategoryQuestions(opts.category, userId);
      
      if (previousCustomQuestions.length > 0) {
        // Add the custom category questions to the previousQuestions array
        const customQuestionsAsQuestions = previousCustomQuestions.map(q => ({
          question: q,
          choices: [],
          answer: '',
          category: opts.category!,
          difficulty: opts.difficulty || 'normal',
          pointMultiplier: 1
        } as Question));
        
        enhancedOpts = {
          ...opts,
          previousQuestions: [...(opts.previousQuestions || []), ...customQuestionsAsQuestions]
        };
        
        logger.info('Enhanced options with previous custom category questions', {
          category: opts.category,
          userId,
          addedCount: previousCustomQuestions.length
        });
      }
    }
    
    // Generate the question
    let question = await generateQuestionCore(userId, enhancedOpts);
    
    // Check if we got an external question
    if (question.source) {
      messages.push({
        type: 'success',
        message: `Found a great question from ${question.source}!`,
        timestamp: Date.now(),
        detail: 'Verifying difficulty and category match...'
      });
    } else if (!isCustomCategory && opts.mode === 'category') {
      // We tried to get external but fell back to AI
      messages.push({
        type: 'info',
        message: `Question bank exhausted after 3 attempts, generating with AI...`,
        timestamp: Date.now(),
        detail: `Using ${question.difficulty || 'normal'} difficulty`
      });
    }
    
    // Check for duplicates message
    messages.push({
      type: 'checking',
      message: 'Checking against all previous questions...',
      timestamp: Date.now()
    });
    
    // Simulate checking time
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Check if we had to retry for duplicates (cached per invocation)
    const allPreviousQuestions = await getAllQuestionsFlat() as Question[];

    // Check if this is a duplicate
    if (isDuplicateQuestion(question, allPreviousQuestions)) {
      messages.push({
        type: 'info',
        message: 'Cooking up something fresh...',
        timestamp: Date.now()
      });
      
      retriesNeeded++;
      
      // Generate a new one
      await new Promise(resolve => setTimeout(resolve, 1000));
      question = await generateQuestionCore(userId, { ...enhancedOpts, previousQuestions: allPreviousQuestions });
    }
    
    // Fact checking
    messages.push({
      type: 'checking',
      message: 'Fact-checking your question...',
      timestamp: Date.now()
    });
    
    // Simulate fact checking time
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Get the difficulty from options
    const difficulty = opts.difficulty;
    
    // Add difficulty checking message if difficulty is specified
    if (difficulty) {
      messages.push({
        type: 'checking',
        message: `Verifying ${difficulty} difficulty level...`,
        timestamp: Date.now()
      });
      await new Promise(resolve => setTimeout(resolve, 600));
    }
    
    const factCheckResult = await factCheckQuestion(question, difficulty);
    
    if (!factCheckResult.isAccurate || factCheckResult.difficultyMismatch) {
      // Just regenerate without explaining why
      messages.push({
        type: 'info',
        message: 'Just a moment, making it better...',
        timestamp: Date.now()
      });
      
      retriesNeeded++;
      
      // Generate a new question
      await new Promise(resolve => setTimeout(resolve, 1000));
      question = await generateQuestionCore(userId, enhancedOpts);
      
      // Re-check
      const secondCheck = await factCheckQuestion(question, difficulty);
      messages.push({
        type: 'success',
        message: `Okay, ${secondCheck.checkedBy} agrees the question is good!`,
        timestamp: Date.now()
      });
    } else {
      messages.push({
        type: 'success',
        message: `Okay, ${factCheckResult.checkedBy} agrees the question is good!`,
        timestamp: Date.now()
      });
    }
    
    // Final message
    messages.push({
      type: 'success',
      message: 'Question is ready!',
      timestamp: Date.now()
    });
    
    return {
      question,
      messages,
      factCheckResult,
      retriesNeeded
    };
    
  } catch (error) {
    logger.error('Error generating question with progress', { error, userId, opts });
    
    // Just say we're making a new one
    messages.push({
      type: 'info',
      message: 'One more moment...',
      timestamp: Date.now()
    });
    
    // Generate a fresh question
    try {
      const question = await generateQuestionCore(userId, enhancedOpts);
      
      messages.push({
        type: 'success',
        message: 'Question is ready!',
        timestamp: Date.now()
      });
      
      return {
        question,
        messages,
        retriesNeeded: retriesNeeded + 1
      };
    } catch (retryError) {
      // If it still fails, just try one more time without any error messages
      logger.error('Retry also failed', { retryError, userId, opts });
      const question = await generateQuestionCore(userId, enhancedOpts);
      
      return {
        question,
        messages: [{
          type: 'success',
          message: 'Question is ready!',
          timestamp: Date.now()
        }],
        retriesNeeded: retriesNeeded + 2
      };
    }
  }
}

/**
 * Stream progress messages (for future WebSocket/SSE implementation)
 */
export async function* generateQuestionStream(
  userId: string,
  opts: GenerateQuestionOptions
): AsyncGenerator<ProgressMessage | QuestionWithProgress> {
  const messages: ProgressMessage[] = [];
  
  // Yield start message
  const startMsg: ProgressMessage = {
    type: 'info',
    message: `Generating your question in ${opts.category || opts.mode}...`,
    timestamp: Date.now()
  };
  messages.push(startMsg);
  yield startMsg;
  
  // Generate question
  const question = await generateQuestionCore(userId, opts);
  
  // Yield checking message
  const checkMsg: ProgressMessage = {
    type: 'checking',
    message: 'Checking against all previous questions...',
    timestamp: Date.now()
  };
  messages.push(checkMsg);
  yield checkMsg;
  
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Fact check
  const factCheckMsg: ProgressMessage = {
    type: 'checking',
    message: 'Fact-checking your question...',
    timestamp: Date.now()
  };
  messages.push(factCheckMsg);
  yield factCheckMsg;
  
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  const difficulty = opts.difficulty;
  
  // Add difficulty checking message if difficulty is specified
  if (difficulty) {
    const difficultyMsg: ProgressMessage = {
      type: 'checking',
      message: `Verifying ${difficulty} difficulty level...`,
      timestamp: Date.now()
    };
    messages.push(difficultyMsg);
    yield difficultyMsg;
    await new Promise(resolve => setTimeout(resolve, 600));
  }
  
  const factCheckResult = await factCheckQuestion(question, difficulty);
  
  const resultMsg: ProgressMessage = {
    type: 'success',
    message: `Okay, ${factCheckResult.checkedBy} agrees the question is good!`,
    timestamp: Date.now()
  };
  messages.push(resultMsg);
  yield resultMsg;
  
  const finalMsg: ProgressMessage = {
    type: 'success',
    message: 'Question is ready!',
    timestamp: Date.now()
  };
  messages.push(finalMsg);
  yield finalMsg;
  
  // Final yield with complete result
  yield {
    question,
    messages,
    factCheckResult,
    retriesNeeded: 0
  };
}