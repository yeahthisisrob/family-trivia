// File: lambda/routes/weeklyFactSummary.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson, putJson, fileExists, listObjects } from '../services/s3';
import { successResponse, errorResponse } from '../config';
import { S3_PATHS } from '../constants';
import { generateDailyFactSummary } from '../services/bedrock/facts/dailySummary';
import { getFactHistory } from '../services/factHistoryService';
import { getRecentRounds } from '../services/familyFeudService';
import { logger } from '../services/logger';
import { getEasternDateString, getWeekStartDateET as getWeekStartDate } from '@family-trivia/shared';

interface WeeklyFactSummary {
  weekStartDate: string;
  weekEndDate: string;
  summary: string;
  lastUpdated: string;
  totalResponses: number;
  robSideResponses: number;
  blairSideResponses: number;
  factType: 'personal' | 'shared' | 'mixed';
  totalQuestions: number;
  uniqueParticipants: number;
  participationRate: number;
  isNewlyGenerated?: boolean;
  dailyBreakdown?: {
    [date: string]: {
      responses: number;
      question?: string;
      questionType: 'basic' | 'shared';
    };
  };
}

export async function getWeeklyFactSummary(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // Check if this is a daily summary request (for backward compatibility)
  const dailyDate = event.queryStringParameters?.date;
  if (dailyDate && !event.queryStringParameters?.weekStart) {
    // This is a daily summary request - redirect to daily summary logic
    // For now, we'll convert it to a weekly request for the week containing this date
    const dateObj = new Date(dailyDate);
    const weekStart = getWeekStartDate(dateObj);
    
    // If the date is in the future or is today, return empty
    const today = getEasternDateString(new Date());
    if (dailyDate >= today) {
      return successResponse({
        date: dailyDate,
        summary: 'Summary not available for future dates.',
        lastUpdated: new Date().toISOString(),
        totalResponses: 0,
        robSideResponses: 0,
        blairSideResponses: 0,
        factType: 'shared'
      });
    }
    
    // Redirect to weekly logic but return in daily format
    event.queryStringParameters = {
      ...event.queryStringParameters,
      weekStart: weekStart
    };
  }
  
  // Get week start date from query params, default to last week
  const requestedWeek = event.queryStringParameters?.weekStart;
  const forceGenerate = event.queryStringParameters?.forceGenerate === 'true';
  
  // Calculate the week to fetch - default to last week
  let targetWeekStart = requestedWeek || (() => {
    const now = new Date();
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    return getWeekStartDate(lastWeek);
  })();
  
  // Log if the requested week start is not a Sunday, but don't adjust it
  // The frontend should be sending the correct Sunday date
  const requestedDate = new Date(targetWeekStart + 'T12:00:00'); // Use noon to avoid timezone issues
  const dayOfWeek = requestedDate.getDay();
  if (dayOfWeek !== 0) {
    logger.warn('Requested week start is not a Sunday', {
      requested: targetWeekStart,
      dayOfWeek: dayOfWeek,
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]
    });
  }
  
  // Calculate week end date (Saturday)
  // Parse the date string as local date (not UTC) to avoid timezone issues
  const [year, month, day] = targetWeekStart.split('-').map(Number);
  const weekEndDate = new Date(year, month - 1, day + 6);
  const targetWeekEnd = `${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth() + 1).padStart(2, '0')}-${String(weekEndDate.getDate()).padStart(2, '0')}`;

  try {
    logger.appendKeys({ targetWeekStart, targetWeekEnd, forceGenerate });
    logger.info('Processing weekly fact summary request');
    
    // Define S3 path for cached summary
    const summaryPath = `facts/weekly-summaries/${targetWeekStart}.json`;
    
    // Check if cached summary exists
    if (!forceGenerate) {
      const summaryExists = await fileExists(summaryPath);
      if (summaryExists) {
        logger.info('Loading existing weekly fact summary');
        const existingSummary = await getJson<WeeklyFactSummary>(summaryPath);
        if (existingSummary) {
          // Check if the cached summary has all required fields
          // If not, force regeneration
          const hasAllFields = 
            typeof existingSummary.totalQuestions === 'number' &&
            typeof existingSummary.uniqueParticipants === 'number' &&
            typeof existingSummary.participationRate === 'number' &&
            existingSummary.dailyBreakdown !== undefined;
          
          if (hasAllFields) {
            logger.info('Returning cached weekly fact summary with all fields');
            return successResponse({
              ...existingSummary,
              isNewlyGenerated: false
            });
          } else {
            logger.info('Cached summary missing new fields, will regenerate', {
              hasTotalQuestions: typeof existingSummary.totalQuestions === 'number',
              hasUniqueParticipants: typeof existingSummary.uniqueParticipants === 'number',
              hasParticipationRate: typeof existingSummary.participationRate === 'number',
              hasDailyBreakdown: existingSummary.dailyBreakdown !== undefined
            });
            // Continue to regeneration
          }
        }
      }
    }
    
    // Need to generate summary - collect all facts for the week
    logger.info('Collecting facts for week', { targetWeekStart, targetWeekEnd });
    
    // Load family hierarchy to get user information
    const hierarchy = await getJson<any>(S3_PATHS.FAMILY_HIERARCHY);
    if (!hierarchy?.family?.people) {
      return errorResponse('Family hierarchy not found', 500);
    }
    
    // Collect facts from all users for the target date
    const allFacts: any[] = [];
    const userIds = Object.keys(hierarchy.family.people);
    const uniqueParticipants = new Set<string>();
    const uniqueQuestions = new Set<string>();
    const dailyBreakdown: WeeklyFactSummary['dailyBreakdown'] = {};
    
    logger.info('Collecting facts for week', { 
      userCount: userIds.length,
      targetWeekStart,
      targetWeekEnd
    });

    // First, get all shared questions for this week
    // This handles both legacy daily shared questions and new weekly shared questions
    const sharedQuestionsDir = 'facts/daily/shared/';
    const sharedQuestions: Map<string, any> = new Map();
    
    try {
      const sharedFiles = await listObjects(sharedQuestionsDir);
      logger.info('Found shared question files', { 
        totalFiles: sharedFiles.length,
        sampleFiles: sharedFiles.slice(0, 5)
      });
      
      // Filter for questions within our target week
      for (const sharedFile of sharedFiles) {
        if (!sharedFile.endsWith('.json')) continue;
        
        const filename = sharedFile.split('/').pop() || '';
        const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})\.json$/);
        
        if (dateMatch) {
          const fileDate = dateMatch[1];
          
          // Check if this date falls within our target week
          if (fileDate >= targetWeekStart && fileDate <= targetWeekEnd) {
            try {
              const sharedQuestion = await getJson<any>(sharedFile);
              if (sharedQuestion?.question) {
                sharedQuestions.set(fileDate, sharedQuestion);
                uniqueQuestions.add(sharedQuestion.question);
                logger.info('Found shared question for date', {
                  date: fileDate,
                  question: sharedQuestion.question.substring(0, 50)
                });
              }
            } catch (err: any) {
              logger.warn('Error loading shared question file', { 
                file: sharedFile, 
                error: err.message 
              });
            }
          }
        }
      }
      
      logger.info('Shared questions for week', {
        weekStart: targetWeekStart,
        weekEnd: targetWeekEnd,
        sharedQuestionCount: sharedQuestions.size,
        dates: Array.from(sharedQuestions.keys())
      });
      
      // Initialize daily breakdown with all shared questions
      for (const [sharedDate, sharedQuestion] of sharedQuestions) {
        if (!dailyBreakdown[sharedDate]) {
          dailyBreakdown[sharedDate] = {
            responses: 0,
            question: sharedQuestion.question,
            questionType: 'shared'
          };
        }
      }
      
    } catch (err: any) {
      logger.warn('Error listing shared questions', { error: err.message });
    }
    
    for (const userId of userIds) {
      try {
        const person = hierarchy.family.people[userId];

        // Load user's fact history and match against shared question dates
        const userEntries = await getFactHistory(userId);
        const answersByDate = new Map(
          userEntries
            .filter(e => e.questionType === 'shared')
            .map(e => [e.date, e]),
        );

        for (const [sharedDate, sharedQuestion] of sharedQuestions) {
          const fact = answersByDate.get(sharedDate);
          if (!fact) continue;

          const breakdownDate = sharedDate;
          if (!dailyBreakdown[breakdownDate]) {
            dailyBreakdown[breakdownDate] = {
              responses: 0,
              question: sharedQuestion.question,
              questionType: 'shared',
            };
          }

          if (fact.answered && fact.answer && !fact.skipped) {
            uniqueParticipants.add(userId);
            dailyBreakdown[breakdownDate].responses++;

            allFacts.push({
              userId,
              userName: person?.name || userId,
              familySide: person?.familySide || 'unknown',
              groupId: person?.groupId || 'unknown',
              groupName: hierarchy.family.groups?.[person?.groupId]?.name || 'Unknown Group',
              question: sharedQuestion.question,
              answer: fact.answer,
              questionType: 'shared',
              timestamp: fact.timestamp,
              date: fact.date,
            });
          }
        }
        
        // Skip basic questions - weekly summaries should only include shared questions
        // Basic questions are for individual catch-up, not weekly summaries
      } catch (err: any) {
        logger.warn('Error listing facts for user', { userId, error: err.message });
      }
    }
    
    logger.info('Facts collected', { 
      count: allFacts.length,
      targetWeekStart,
      targetWeekEnd,
      uniqueQuestionsCount: uniqueQuestions.size,
      uniqueParticipantsCount: uniqueParticipants.size,
      allUniqueQuestions: Array.from(uniqueQuestions),
      dailyBreakdownDates: Object.keys(dailyBreakdown).sort(),
      factDetails: allFacts.slice(0, 3) // Log first 3 facts as sample
    });
    
    if (allFacts.length === 0) {
      // No facts for this week
      logger.warn('No facts found for week', { 
        targetWeekStart,
        targetWeekEnd,
        checkedUsers: userIds.length 
      });
      
      const noFactsSummary: WeeklyFactSummary = {
        weekStartDate: targetWeekStart,
        weekEndDate: targetWeekEnd,
        summary: 'No family members shared facts this week.',
        lastUpdated: new Date().toISOString(),
        totalResponses: 0,
        robSideResponses: 0,
        blairSideResponses: 0,
        factType: 'shared',
        totalQuestions: 0,
        uniqueParticipants: 0,
        participationRate: 0,
        dailyBreakdown
      };
      
      // Cache even empty result
      await putJson(summaryPath, noFactsSummary);
      return successResponse(noFactsSummary);
    }
    
    // Count responses by family side
    const robSideResponses = allFacts.filter(f => f.familySide === 'rob').length;
    const blairSideResponses = allFacts.filter(f => f.familySide === 'blair').length;
    
    // Determine fact type for the week - should always be 'shared' now
    const factType: WeeklyFactSummary['factType'] = 'shared';
    
    // Calculate statistics
    const totalQuestions = uniqueQuestions.size;
    const participationRate = userIds.length > 0 ? 
      (uniqueParticipants.size / userIds.length) * 100 : 0;
    
    // Load completed Family Feud rounds for this week
    let familyFeudRounds: any[] = [];
    try {
      const allRounds = await getRecentRounds(50);
      familyFeudRounds = allRounds
        .filter(r => {
          if (r.status !== 'completed') return false;
          // Check if round falls within this week
          const roundDate = r.startedAt?.split('T')[0];
          return roundDate && roundDate >= targetWeekStart && roundDate <= targetWeekEnd;
        })
        .map(r => ({
          question: r.question,
          targetUserName: r.targetUserName,
          realAnswer: r.realAnswer,
          guesses: r.guesses,
          results: r.results,
        }));
      logger.info('Family Feud rounds for week', { count: familyFeudRounds.length });
    } catch (err) {
      logger.warn('Failed to load Family Feud rounds for weekly summary', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Generate AI summary using Bedrock
    logger.info('Generating weekly fact summary');
    let summary: string;

    try {
      summary = await generateDailyFactSummary({
        date: `${targetWeekStart} to ${targetWeekEnd}`,
        facts: allFacts,
        factType: 'shared', // Always shared for weekly summaries
        robSideCount: robSideResponses,
        blairSideCount: blairSideResponses,
        hierarchy,
        familyFeudRounds,
      });
      
      logger.info('Successfully generated summary', { 
        summaryLength: summary.length,
        summaryPreview: summary.substring(0, 100) 
      });
    } catch (genError: any) {
      logger.error('Failed to generate summary with AI, using fallback', {
        error: genError.message,
        stack: genError.stack
      });
      
      // Create a fallback summary so S3 file still gets created
      summary = `Weekly Facts Summary for ${targetWeekStart} to ${targetWeekEnd}\n\n` +
        `Total responses: ${allFacts.length} (Side A: ${robSideResponses}, Side B: ${blairSideResponses})\n\n` +
        `This week featured ${uniqueQuestions.size} shared questions for the whole family.\n\n` +
        `[AI summary generation failed - showing basic stats only]`;
    }
    
    const weeklySummary: WeeklyFactSummary = {
      weekStartDate: targetWeekStart,
      weekEndDate: targetWeekEnd,
      summary,
      lastUpdated: new Date().toISOString(),
      totalResponses: allFacts.length,
      robSideResponses,
      blairSideResponses,
      factType,
      totalQuestions,
      uniqueParticipants: uniqueParticipants.size,
      participationRate,
      dailyBreakdown
    };
    
    // Cache the summary
    logger.info('Caching weekly fact summary', { summaryPath });
    await putJson(summaryPath, weeklySummary);
    
    return successResponse({
      ...weeklySummary,
      isNewlyGenerated: true
    });
    
  } catch (err: any) {
    logger.error('Error generating weekly fact summary', { 
      error: err.message, 
      stack: err.stack 
    });
    return errorResponse('Failed to generate weekly fact summary', 500);
  } finally {
    logger.removeKeys(['targetWeekStart', 'targetWeekEnd', 'forceGenerate']);
  }
}