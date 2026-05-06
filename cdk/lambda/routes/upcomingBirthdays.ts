// File: lambda/routes/upcomingBirthdays.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { getJson } from '../services/s3';
import { getAllFactHistories } from '../services/factHistoryService';
import { S3_PATHS } from '../constants';
import { isTodayET, getDaysUntilET, getCurrentYearET } from '@family-trivia/shared';

interface Birthday {
  userId: string;
  name: string;
  birthday: string; // Original answer
  month: number;
  day: number;
  daysUntil: number;
  isToday: boolean;
  isPast: boolean;
  type?: 'birthday' | 'anniversary' | 'holiday' | 'other';
  description?: string;
  year?: number;
  celebrationId?: string;
  isFromFacts?: boolean;
}

interface UpcomingBirthdaysResponse {
  birthdays: Birthday[];
  todaysBirthdays: Birthday[];
}

interface Celebration {
  id: string;
  type: 'birthday' | 'anniversary' | 'holiday' | 'other';
  name: string;
  date: string; // MM/DD format
  description?: string;
  addedBy: string;
  addedAt: string;
  recurring: boolean;
  year?: number;
}

/**
 * Parse various birthday formats into month and day
 */
function parseBirthday(birthdayStr: string): { month: number; day: number } | null {
  // Skip non-answers
  if (!birthdayStr || birthdayStr === '[Skipped]' || birthdayStr.toLowerCase() === 'confidential') {
    return null;
  }

  // Try MM/DD or M/D format first
  const slashMatch = birthdayStr.match(/^(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) {
    return {
      month: parseInt(slashMatch[1], 10),
      day: parseInt(slashMatch[2], 10)
    };
  }

  // Try MMDD format (like "0913")
  const fourDigitMatch = birthdayStr.match(/^(\d{2})(\d{2})$/);
  if (fourDigitMatch) {
    return {
      month: parseInt(fourDigitMatch[1], 10),
      day: parseInt(fourDigitMatch[2], 10)
    };
  }

  // Try text format (like "July 24th 1950" or "April 1")
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  
  const lowerStr = birthdayStr.toLowerCase();
  for (let i = 0; i < months.length; i++) {
    if (lowerStr.includes(months[i]) || lowerStr.includes(months[i].substring(0, 3))) {
      // Extract day number after month
      const dayMatch = birthdayStr.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
      if (dayMatch) {
        return {
          month: i + 1,
          day: parseInt(dayMatch[1], 10)
        };
      }
    }
  }

  return null;
}

/**
 * Calculate days until next birthday occurrence (using Eastern Time)
 */
function calculateDaysUntil(month: number, day: number): { daysUntil: number; isToday: boolean; isPast: boolean } {
  // Check if the date is today in ET
  const isToday = isTodayET(month, day);
  
  // Calculate days until the date
  const daysUntil = isToday ? 0 : getDaysUntilET(month, day);
  
  // Determine if the date has passed this year (will be > 300 days if next year)
  const isPast = daysUntil > 300;
  
  return { daysUntil, isToday, isPast };
}

export async function getUpcomingBirthdays(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    logger.info('Fetching upcoming birthdays and celebrations');
    
    // Get family hierarchy to get names
    const hierarchy = await getJson<any>(S3_PATHS.FAMILY_HIERARCHY);
    if (!hierarchy?.family?.people) {
      return errorResponse('Family hierarchy not found', 404);
    }

    const birthdays: Birthday[] = [];

    // Read birthday answers from all users' consolidated histories
    const allHistories = await getAllFactHistories();
    const birthdayResults = await Promise.all(
      [...allHistories.entries()].map(async ([userId, entries]) => {
        const personData = hierarchy.family.people[userId] as any;
        if (!personData) return null;

        const birthdayEntry = entries.find(e => e.questionType === 'basic' && e.questionIndex === 0 && e.answered);
        if (!birthdayEntry?.answer) return null;

        try {
          const parsed = parseBirthday(birthdayEntry.answer);
          if (!parsed || parsed.month < 1 || parsed.month > 12 || parsed.day < 1 || parsed.day > 31) return null;

          const { daysUntil, isToday, isPast } = calculateDaysUntil(parsed.month, parsed.day);

          return {
            userId,
            name: personData.name || userId,
            birthday: birthdayEntry.answer,
            month: parsed.month,
            day: parsed.day,
            daysUntil,
            isToday,
            isPast,
            type: 'birthday' as const,
            isFromFacts: true,
          };
        } catch {
          return null;
        }
      }),
    );

    for (const result of birthdayResults) {
      if (result) birthdays.push(result as Birthday);
    }
    
    // Now, get celebrations from the celebrations file
    try {
      const celebrationsData = await getJson<{ celebrations: Celebration[] }>('celebrations/celebrations.json');
      if (celebrationsData?.celebrations) {
        for (const celebration of celebrationsData.celebrations) {
          // Parse the date
          const [monthStr, dayStr] = celebration.date.split('/');
          const month = parseInt(monthStr, 10);
          const day = parseInt(dayStr, 10);
          
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const { daysUntil, isToday, isPast } = calculateDaysUntil(month, day);
            
            birthdays.push({
              userId: celebration.addedBy,
              name: celebration.name,
              birthday: celebration.date,
              month,
              day,
              daysUntil,
              isToday,
              isPast,
              type: celebration.type,
              description: celebration.description,
              year: celebration.year,
              celebrationId: celebration.id,
              isFromFacts: false
            });
          }
        }
      }
    } catch (err) {
      logger.debug('Could not read celebrations file', { error: err });
    }
    
    // Sort by days until birthday
    birthdays.sort((a, b) => a.daysUntil - b.daysUntil);
    
    // Get today's birthdays
    const todaysBirthdays = birthdays.filter(b => b.isToday);
    
    // Get upcoming birthdays (next 365 days, excluding today)
    const limit = parseInt(event.queryStringParameters?.limit || '10', 10);
    const upcomingBirthdays = birthdays
      .filter(b => !b.isToday && b.daysUntil <= 365)
      .slice(0, Math.min(limit, 100));
    
    logger.info('Found birthdays', { 
      total: birthdays.length,
      today: todaysBirthdays.length,
      upcoming: upcomingBirthdays.length
    });
    
    return successResponse({
      birthdays: upcomingBirthdays,
      todaysBirthdays
    });
    
  } catch (error: any) {
    logger.error('Error fetching upcoming birthdays', { 
      error: error.message,
      stack: error.stack 
    });
    
    return errorResponse('Failed to fetch upcoming birthdays', 500);
  }
}