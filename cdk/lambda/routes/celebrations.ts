// File: lambda/routes/celebrations.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { getJson, putJson } from '../services/s3';
import { getFactHistory } from '../services/factHistoryService';
import { S3_PATHS } from '../constants';

interface Celebration {
  id: string;
  type: 'birthday' | 'anniversary' | 'holiday' | 'other';
  name: string;
  date: string; // MM/DD format
  description?: string;
  addedBy: string;
  addedAt: string;
  recurring: boolean;
  year?: number; // For anniversaries or age calculations
}

interface CelebrationsData {
  celebrations: Celebration[];
  lastUpdated: string;
}

const CELEBRATIONS_PATH = 'celebrations/celebrations.json';

/**
 * Add a new celebration
 */
export async function addCelebration(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { type, name, date, description, addedBy, recurring = true, year } = body;
    
    // Validate required fields
    if (!type || !name || !date || !addedBy) {
      return errorResponse('Missing required fields: type, name, date, addedBy', 400);
    }
    
    // Validate date format (MM/DD)
    const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/;
    if (!dateRegex.test(date)) {
      return errorResponse('Invalid date format. Please use MM/DD', 400);
    }
    
    // Validate type
    const validTypes = ['birthday', 'anniversary', 'holiday', 'other'];
    if (!validTypes.includes(type)) {
      return errorResponse('Invalid celebration type', 400);
    }
    
    logger.info('Adding new celebration', { type, name, date, addedBy });
    
    // Load existing celebrations
    let celebrationsData: CelebrationsData = {
      celebrations: [],
      lastUpdated: new Date().toISOString()
    };
    
    try {
      const existing = await getJson<CelebrationsData>(CELEBRATIONS_PATH);
      if (existing) {
        celebrationsData = existing;
      }
    } catch (err) {
      logger.debug('No existing celebrations file, creating new one');
    }
    
    // Create new celebration
    const newCelebration: Celebration = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      name,
      date,
      description,
      addedBy,
      addedAt: new Date().toISOString(),
      recurring,
      year
    };
    
    // Add to celebrations array
    celebrationsData.celebrations.push(newCelebration);
    celebrationsData.lastUpdated = new Date().toISOString();
    
    // Save to S3
    await putJson(CELEBRATIONS_PATH, celebrationsData);
    
    logger.info('Celebration added successfully', { id: newCelebration.id });
    
    return successResponse({
      success: true,
      celebration: newCelebration
    });
    
  } catch (error: any) {
    logger.error('Error adding celebration', { 
      error: error.message,
      stack: error.stack 
    });
    
    return errorResponse('Failed to add celebration', 500);
  }
}

/**
 * Get all celebrations (including birthdays from facts)
 */
export async function getCelebrations(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    logger.info('Fetching all celebrations including birthdays from facts');
    
    // Get family hierarchy
    const hierarchy = await getJson<any>(S3_PATHS.FAMILY_HIERARCHY);
    const peopleMap = hierarchy?.family?.people || {};
    const allCelebrations: any[] = [];
    
    // Load manual celebrations
    let celebrationsData: CelebrationsData = {
      celebrations: [],
      lastUpdated: new Date().toISOString()
    };
    
    try {
      const existing = await getJson<CelebrationsData>(CELEBRATIONS_PATH);
      if (existing) {
        celebrationsData = existing;
      }
    } catch (err) {
      logger.debug('No celebrations file found');
    }
    
    // Add manual celebrations with user names
    celebrationsData.celebrations.forEach(celebration => {
      allCelebrations.push({
        ...celebration,
        addedByName: peopleMap[celebration.addedBy]?.name || celebration.addedBy,
        isManual: true
      });
    });
    
    // Function to parse various date formats
    const parseBirthday = (birthdayStr: string): { month: number; day: number } | null => {
      // Skip non-answers
      if (!birthdayStr || birthdayStr === '[Skipped]' || birthdayStr.toLowerCase() === 'confidential') {
        return null;
      }
      
      // Try MM/DD format
      const mmddMatch = birthdayStr.match(/^(\d{1,2})\/(\d{1,2})$/);
      if (mmddMatch) {
        return { month: parseInt(mmddMatch[1]), day: parseInt(mmddMatch[2]) };
      }
      
      // Try MMDD format
      const mmddNoSlashMatch = birthdayStr.match(/^(\d{2})(\d{2})$/);
      if (mmddNoSlashMatch) {
        return { month: parseInt(mmddNoSlashMatch[1]), day: parseInt(mmddNoSlashMatch[2]) };
      }
      
      // Try text format (e.g., "July 24th", "December 1st")
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                         'july', 'august', 'september', 'october', 'november', 'december'];
      const textMatch = birthdayStr.toLowerCase().match(/^(\w+)\s+(\d{1,2})/);
      if (textMatch) {
        const monthIndex = monthNames.indexOf(textMatch[1].toLowerCase());
        if (monthIndex !== -1) {
          return { month: monthIndex + 1, day: parseInt(textMatch[2]) };
        }
      }
      
      return null;
    };
    
    // Add birthdays from facts
    for (const [userId, person] of Object.entries(peopleMap)) {
      if (!person || typeof person !== 'object') continue;
      
      try {
        // Look for birthday answer (basic question index 0) from consolidated history
        const factEntries = await getFactHistory(userId);
        const birthdayEntry = factEntries.find(e => e.questionType === 'basic' && e.questionIndex === 0 && e.answered);

        if (birthdayEntry) {
          const birthdayAnswer = birthdayEntry.answer;

          if (birthdayAnswer) {
            const parsed = parseBirthday(birthdayAnswer);
            if (parsed && parsed.month >= 1 && parsed.month <= 12 && parsed.day >= 1 && parsed.day <= 31) {
              const dateStr = `${String(parsed.month).padStart(2, '0')}/${String(parsed.day).padStart(2, '0')}`;
              
              // Check if this birthday is already in manual celebrations
              const isDuplicate = allCelebrations.some(c => 
                c.type === 'birthday' && 
                c.date === dateStr && 
                c.name.toLowerCase().includes((person as any).name.toLowerCase())
              );
              
              if (!isDuplicate) {
                allCelebrations.push({
                  id: `fact-birthday-${userId}`,
                  type: 'birthday',
                  name: `${(person as any).name}'s Birthday`,
                  date: dateStr,
                  addedBy: 'system',
                  addedByName: 'From Facts',
                  addedAt: birthdayEntry.timestamp || new Date().toISOString(),
                  recurring: true,
                  isFromFacts: true
                });
                logger.debug(`Added birthday for ${(person as any).name}: ${dateStr}`);
              }
            }
          }
        }
      } catch (err) {
        logger.debug(`No birthday facts for user ${userId}`);
      }
    }
    
    // Sort by month and day
    allCelebrations.sort((a, b) => {
      const [aMonth, aDay] = a.date.split('/').map(Number);
      const [bMonth, bDay] = b.date.split('/').map(Number);
      if (aMonth !== bMonth) return aMonth - bMonth;
      return aDay - bDay;
    });
    
    logger.info('Found all celebrations', { 
      total: allCelebrations.length,
      manual: celebrationsData.celebrations.length,
      fromFacts: allCelebrations.filter(c => c.isFromFacts).length,
      peopleCount: Object.keys(peopleMap).length,
      celebrations: allCelebrations.map(c => ({ 
        name: c.name, 
        date: c.date, 
        isFromFacts: c.isFromFacts 
      }))
    });
    
    return successResponse({
      celebrations: allCelebrations,
      lastUpdated: celebrationsData.lastUpdated
    });
    
  } catch (error: any) {
    logger.error('Error fetching celebrations', { 
      error: error.message,
      stack: error.stack 
    });
    
    return errorResponse('Failed to fetch celebrations', 500);
  }
}

/**
 * Delete a celebration
 */
export async function deleteCelebration(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const celebrationId = event.queryStringParameters?.id;
    const userId = event.queryStringParameters?.userId;
    
    if (!celebrationId || !userId) {
      return errorResponse('Missing required parameters: id, userId', 400);
    }
    
    logger.info('Deleting celebration', { celebrationId, userId });
    
    // Load existing celebrations
    const celebrationsData = await getJson<CelebrationsData>(CELEBRATIONS_PATH);
    if (!celebrationsData) {
      return errorResponse('No celebrations found', 404);
    }
    
    // Find the celebration
    const celebrationIndex = celebrationsData.celebrations.findIndex(c => c.id === celebrationId);
    if (celebrationIndex === -1) {
      return errorResponse('Celebration not found', 404);
    }
    
    // Check if user can delete (either they added it or it's their own birthday from facts)
    const celebration = celebrationsData.celebrations[celebrationIndex];
    if (celebration.addedBy !== userId) {
      return errorResponse('You can only delete celebrations you added', 403);
    }
    
    // Remove the celebration
    celebrationsData.celebrations.splice(celebrationIndex, 1);
    celebrationsData.lastUpdated = new Date().toISOString();
    
    // Save to S3
    await putJson(CELEBRATIONS_PATH, celebrationsData);
    
    logger.info('Celebration deleted successfully', { celebrationId });
    
    return successResponse({
      success: true,
      message: 'Celebration deleted successfully'
    });
    
  } catch (error: any) {
    logger.error('Error deleting celebration', { 
      error: error.message,
      stack: error.stack 
    });
    
    return errorResponse('Failed to delete celebration', 500);
  }
}