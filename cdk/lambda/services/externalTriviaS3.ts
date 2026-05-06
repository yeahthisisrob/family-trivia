import { logger } from './logger';
import { getJson } from './s3';

export interface ExternalTriviaQuestion {
  question: string;
  choices: string[];
  answer: string;
  category: string;
  difficulty?: 'easy' | 'normal' | 'hard';
  source: string;
  sourceUrl?: string;
  externalId?: string;
  type?: string;
}

interface TriviaFile {
  timestamp: string;
  count: number;
  questions: ExternalTriviaQuestion[];
}

interface TriviaCacheEntry {
  questions: ExternalTriviaQuestion[];
  loadedAt: number;
}

class ExternalTriviaS3Service {
  private cache: Map<string, TriviaCacheEntry> = new Map();
  private usedQuestionIds: Set<string> = new Set();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(category: string, difficulty: string): string {
    return `${category}/${difficulty}`;
  }

  private sanitizeCategoryForS3(category: string): string {
    return category.replace(/[^a-zA-Z0-9]/g, '_');
  }

  private async loadQuestionsFromS3(category: string, difficulty: string): Promise<ExternalTriviaQuestion[]> {
    const cacheKey = this.getCacheKey(category, difficulty);
    const cached = this.cache.get(cacheKey);
    
    // Return cached data if fresh
    if (cached && Date.now() - cached.loadedAt < this.CACHE_DURATION) {
      logger.info('Using cached questions', { category, difficulty, count: cached.questions.length });
      return cached.questions;
    }

    try {
      const sanitizedCategory = this.sanitizeCategoryForS3(category);
      const s3Key = `trivia-bank/${sanitizedCategory}/${difficulty}.json`;
      
      logger.info('Loading questions from S3', { s3Key });
      
      const data = await getJson<TriviaFile>(s3Key);
      
      if (!data || !data.questions) {
        logger.warn('No questions found in S3', { s3Key });
        return [];
      }

      // Cache the loaded questions
      this.cache.set(cacheKey, {
        questions: data.questions,
        loadedAt: Date.now()
      });

      logger.info('Loaded questions from S3', {
        category,
        difficulty,
        count: data.questions.length,
        timestamp: data.timestamp
      });

      return data.questions;
    } catch (error) {
      logger.error('Error loading questions from S3', {
        category,
        difficulty,
        error: error as Error
      });
      return [];
    }
  }

  public async getRandomQuestion(
    category?: string,
    difficulty?: 'easy' | 'normal' | 'hard',
    avoidIds?: string[]
  ): Promise<ExternalTriviaQuestion | null> {
    if (!category || !difficulty) {
      logger.warn('Category and difficulty are required for S3-based trivia');
      return null;
    }

    logger.info('getRandomQuestion called', {
      category,
      difficulty,
      avoidIds: avoidIds?.length || 0
    });

    // Load questions for this category/difficulty
    const questions = await this.loadQuestionsFromS3(category, difficulty);
    
    if (questions.length === 0) {
      logger.warn('No questions available', { category, difficulty });
      return null;
    }

    // Filter out already used questions
    let availableQuestions = questions;
    
    if (avoidIds && avoidIds.length > 0) {
      const avoidSet = new Set(avoidIds);
      availableQuestions = availableQuestions.filter(q => 
        !avoidSet.has(q.externalId || '')
      );
    }
    
    // Filter out questions used in this session
    availableQuestions = availableQuestions.filter(q => 
      !this.usedQuestionIds.has(q.externalId || '')
    );
    
    if (availableQuestions.length === 0) {
      // Reset used questions if we've exhausted all options
      logger.info('Resetting used questions for category', { category, difficulty });
      this.usedQuestionIds.clear();
      return this.getRandomQuestion(category, difficulty, avoidIds);
    }
    
    // Select random question
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const selectedQuestion = availableQuestions[randomIndex];
    
    // Mark as used
    if (selectedQuestion.externalId) {
      this.usedQuestionIds.add(selectedQuestion.externalId);
    }
    
    logger.info('Selected question', {
      category,
      difficulty,
      source: selectedQuestion.source,
      externalId: selectedQuestion.externalId,
      availableCount: availableQuestions.length
    });
    
    return selectedQuestion;
  }

  public async getQuestionCount(category: string, difficulty: 'easy' | 'normal' | 'hard'): Promise<number> {
    const questions = await this.loadQuestionsFromS3(category, difficulty);
    return questions.length;
  }

  public async getAvailableCategories(): Promise<string[]> {
    try {
      const metadata = await getJson<any>('trivia-bank/metadata.json');
      return metadata?.categories?.map((c: any) => c.category) || [];
    } catch (error) {
      logger.error('Error loading categories from S3', error as Error);
      return [];
    }
  }

  public resetUsedQuestions(): void {
    this.usedQuestionIds.clear();
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
export const externalTriviaS3Service = new ExternalTriviaS3Service();