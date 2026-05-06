// File: lambda/routes/game-modes/shared.ts
// Shared utilities and types for game modes (Casino Rush and Slot Machine)

import { getJson } from '../../services/s3';
import { logger } from '../../services/logger';
import { S3_PATHS } from '../../constants';

// Shared interfaces
export interface GameSession {
  status: 'active' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  mode: 'casino-rush' | 'slot-machine';
}

export interface GameQuestion {
  question: string;
  choices: string[];
  answer: string;
  category: string;
  difficulty: 'easy' | 'normal' | 'hard';
}

// Get all available categories for a user (system + custom)
export async function getAvailableCategories(userId: string): Promise<string[]> {
  try {
    logger.info('Fetching categories for user', { 
      userId,
      systemPath: S3_PATHS.CATEGORIES,
      userPath: S3_PATHS.USER_CATEGORIES(userId)
    });
    
    let systemCategories: any[] = [];
    let userCategories: any[] = [];
    
    try {
      systemCategories = await getJson<any[]>(S3_PATHS.CATEGORIES) || [];
      logger.info('System categories loaded', {
        count: systemCategories.length,
        categories: systemCategories.slice(0, 3) // Log first 3 for debugging
      });
    } catch (err) {
      logger.warn('Failed to load system categories', {
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
    
    try {
      userCategories = await getJson<any[]>(S3_PATHS.USER_CATEGORIES(userId)) || [];
      logger.info('User categories loaded', {
        count: userCategories.length,
        categories: userCategories.slice(0, 3) // Log first 3 for debugging
      });
    } catch (err) {
      logger.info('No custom categories for user', { userId });
    }
    
    const allCategories = [
      ...systemCategories.map(c => c.name),
      ...userCategories.map(c => `Custom: ${c.title}`)
    ];
    
    // If no categories found, use default categories as fallback
    if (allCategories.length === 0) {
      logger.warn('No categories found in S3, using default categories', { userId });
      const defaultCategories = [
        'History & Politics',
        'Science & Nature',
        'Geography & Travel',
        'Pop Culture',
        'Sports & Games',
        'Literature & Arts',
        'Fun Facts & Oddities'
      ];
      return defaultCategories;
    }
    
    logger.info('Available categories for user', {
      userId,
      systemCount: systemCategories.length,
      customCount: userCategories.length,
      totalCount: allCategories.length,
      allCategories: allCategories
    });
    
    return allCategories;
  } catch (error) {
    logger.error('Error getting available categories', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    // Return empty array as fallback
    return [];
  }
}

// Format question for display (consistent across game modes)
export function formatQuestion(question: GameQuestion): GameQuestion {
  return {
    question: question.question,
    choices: question.choices,
    answer: question.answer,
    category: question.category,
    difficulty: question.difficulty || 'normal'
  };
}

// Calculate cooldown period (both modes use 7 days)
export const GAME_MODE_COOLDOWN_DAYS = 7;

export function getNextAvailableDate(lastPlayedDate: Date): Date {
  const nextAvailable = new Date(lastPlayedDate);
  nextAvailable.setDate(nextAvailable.getDate() + GAME_MODE_COOLDOWN_DAYS);
  nextAvailable.setHours(0, 0, 0, 0); // Reset to start of day
  return nextAvailable;
}

// Check if a date is today (Eastern time)
export function isToday(date: Date): boolean {
  const now = new Date();
  const easternNow = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const easternDate = new Date(date.toLocaleString("en-US", { timeZone: "America/New_York" }));
  
  return easternDate.getFullYear() === easternNow.getFullYear() &&
         easternDate.getMonth() === easternNow.getMonth() &&
         easternDate.getDate() === easternNow.getDate();
}