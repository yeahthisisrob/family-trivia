// File: lambda/routes/memberSummary.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson, putJson, fileExists } from '../services/s3';
import { getFactHistory } from '../services/factHistoryService';
import { getRecentRounds } from '../services/familyFeudService';
import { successResponse, errorResponse } from '../config';
import { S3_PATHS } from '../constants';
import { generateMemberSummary } from '../services/bedrock/members/memberSummary';
import { logger } from '../services/logger';

interface BasicQA {
  question: string;
  answer: string;
}

interface MemberInsight {
  text: string;
  category: 'preference' | 'personality' | 'fact' | 'activity' | 'relationship';
}

interface MemberSummary {
  userId: string;
  regularSummary: string;
  roastSummary: string;
  lastUpdated: string;
  // Track when each type of summary was last generated
  generatedAt: {
    regular: string;
    roast: string;
  };
  basicQAs?: BasicQA[];
  insights?: MemberInsight[];
}

export async function getMemberSummary(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  const mode = event.queryStringParameters?.mode || 'regular'; // 'regular' or 'roast'
  const forceGenerate = event.queryStringParameters?.forceGenerate === 'true';
  
  if (!userId) {
    return errorResponse('Missing userId', 400);
  }

  try {
    logger.appendKeys({ userId, mode, forceGenerate });
    logger.info('Processing member summary request');
    
    // Define S3 paths for both caching and data
    const summaryPath = S3_PATHS.USER_SUMMARY(userId);
    
    // Track if we need to generate either summary type
    let generateRegular = forceGenerate;
    let generateRoast = forceGenerate;
    
    // Existing summary data - initialize with empty values
    let existingSummary: MemberSummary = {
      userId,
      regularSummary: '',
      roastSummary: '',
      lastUpdated: new Date().toISOString(),
      generatedAt: {
        regular: '',
        roast: ''
      }
    };
    
    // Check if cached summary exists
    const summaryExists = await fileExists(summaryPath);
    
    if (summaryExists && !forceGenerate) {
      try {
        logger.info('Loading existing member summary');
        // Load existing summary
        const loadedSummary = await getJson<MemberSummary>(summaryPath);
        if (loadedSummary) {
          existingSummary = loadedSummary;
        }
        
        // Check if the summaries are still valid (less than 24 hours old)
        const now = new Date();
        
        // Check regular summary age
        if (existingSummary.generatedAt.regular) {
          const regularAge = new Date(existingSummary.generatedAt.regular);
          const regularDiffHours = (now.getTime() - regularAge.getTime()) / (1000 * 60 * 60);
          generateRegular = regularDiffHours >= 24;
          logger.debug('Regular summary freshness check', { 
            ageHours: regularDiffHours, 
            needsRefresh: generateRegular 
          });
        } else {
          generateRegular = true;
          logger.info('No existing regular summary found');
        }
        
        // Check roast summary age
        if (existingSummary.generatedAt.roast) {
          const roastAge = new Date(existingSummary.generatedAt.roast);
          const roastDiffHours = (now.getTime() - roastAge.getTime()) / (1000 * 60 * 60);
          generateRoast = roastDiffHours >= 24;
          logger.debug('Roast summary freshness check', { 
            ageHours: roastDiffHours, 
            needsRefresh: generateRoast 
          });
        } else {
          generateRoast = true;
          logger.info('No existing roast summary found');
        }
        
        // If the specific requested mode is fresh, return it immediately
        if ((mode === 'regular' && !generateRegular) || (mode === 'roast' && !generateRoast)) {
          logger.info('Returning cached summary', { mode });
          return successResponse({
            userId,
            summary: mode === 'roast' ? existingSummary.roastSummary : existingSummary.regularSummary,
            mode,
            lastUpdated: mode === 'roast' ? existingSummary.generatedAt.roast : existingSummary.generatedAt.regular,
            basicQAs: existingSummary.basicQAs || [],
            insights: existingSummary.insights || []
          });
        }
      } catch (err: any) {
        logger.error('Error reading existing summary', { 
          error: err.message, 
          summaryPath 
        });
        // If there's an error reading the summary, only generate what's requested
        generateRegular = mode === 'regular' || !mode;
        generateRoast = mode === 'roast';
      }
    } else {
      // No summary exists, only generate what's requested
      logger.info('No existing summary found or forced regeneration requested', {
        exists: summaryExists,
        forceGenerate,
        requestedMode: mode
      });
      // Only generate the mode that was requested
      generateRegular = mode === 'regular' || !mode;
      generateRoast = mode === 'roast';
    }
    
    // If we don't need to generate any summaries, return the requested one
    if (!generateRegular && !generateRoast) {
      return successResponse({
        userId,
        summary: mode === 'roast' ? existingSummary.roastSummary : existingSummary.regularSummary,
        mode,
        lastUpdated: mode === 'roast' ? existingSummary.generatedAt.roast : existingSummary.generatedAt.regular,
        basicQAs: existingSummary.basicQAs || [],
        insights: existingSummary.insights || []
      });
    }
    
    // At this point, we need to generate one or both summaries
    
    // 1) Get user profile data (or continue without profile)
    // We don't need the profile data for generating summaries, it's just to check the user exists
    const userProfilePath = S3_PATHS.USER_PROFILE(userId);
    const userProfileExists = await fileExists(userProfilePath);
    
    // Check if user profile exists but continue even if it doesn't as long as we have other data
    if (!userProfileExists) {
      logger.warn('User profile not found, attempting to generate summary anyway', { userProfilePath });
      
      // If we already have summaries, return what we have
      if (existingSummary.regularSummary || existingSummary.roastSummary) {
        logger.info('Returning existing summary despite missing user profile');
        return successResponse({
          userId,
          summary: mode === 'roast' ? existingSummary.roastSummary : existingSummary.regularSummary,
          mode,
          lastUpdated: existingSummary.lastUpdated,
          basicQAs: existingSummary.basicQAs || [],
          insights: existingSummary.insights || []
        });
      }
      
      // We'll still try to generate a summary from other data sources
    }

    // 2) Load raw answer history
    logger.info('Loading user answer history');
    const rawHistory = await getJson<any[]>(S3_PATHS.ANSWER_HISTORY(userId)) || [];
    
    // 3) Load facts from consolidated history
    logger.info('Loading user facts');
    const factEntries = await getFactHistory(userId);
    const facts = factEntries
      .filter(f => f.answered && f.question && f.answer)
      .map(f => ({
        question: f.question, answer: f.answer, fact: f.fact || '',
        timestamp: f.timestamp || '', questionType: f.questionType || 'basic',
        skipped: f.skipped || false, answered: f.answered,
      }));
    logger.info('Facts loaded', { count: facts.length });

    // 4) Load family hierarchy to get relationships and name
    const hierarchy = await getJson<any>(S3_PATHS.FAMILY_HIERARCHY);
    let memberInfo = null;
    let memberName = userId; // Default to user ID if name not found
    
    if (hierarchy?.family?.people) {
      memberInfo = hierarchy.family.people[userId];
      if (memberInfo?.name) {
        memberName = memberInfo.name;
      }
    }

    // 5) Get custom categories created by this user
    const customCategories = await getJson<any[]>(S3_PATHS.USER_CATEGORIES(userId)) || [];

    // 6) Load completed Family Feud rounds (where user was target or guesser)
    let familyFeudRounds: any[] = [];
    try {
      const allRounds = await getRecentRounds(50);
      familyFeudRounds = allRounds.filter(r =>
        r.status === 'completed' &&
        (r.targetUserId === userId || r.guesses?.[userId]),
      );
      logger.info('Family Feud rounds loaded', { count: familyFeudRounds.length });
    } catch (err) {
      logger.warn('Failed to load Family Feud rounds', { error: err instanceof Error ? err.message : String(err) });
    }

    // Prepare updated summary information
    const now = new Date().toISOString();
    let updatedSummary = { ...existingSummary };
    
    // 6) Generate the summaries using Bedrock - but only the ones we need
    if (generateRegular && generateRoast) {
      // Generate both summaries - this should be rare now
      logger.info('Generating both regular and roast summaries');
      const result = await generateMemberSummary({
        userId,
        name: memberName,
        answerHistory: rawHistory,
        facts,
        memberInfo,
        customCategories,
        familyFeudRounds,
      });
      
      const regularSummary = result.regularSummary || 'Unable to generate regular summary';
      const roastSummary = result.roastSummary || 'Unable to generate roast summary';
      
      updatedSummary = {
        userId,
        regularSummary,
        roastSummary,
        lastUpdated: now,
        generatedAt: {
          regular: now,
          roast: now
        },
        basicQAs: result.basicQAs || [],
        insights: result.insights || []
      };
      
      logger.info('Both summaries generated successfully');
    } else if (generateRegular) {
      // Only generate regular summary
      logger.info('Generating only regular summary');
      const result = await generateMemberSummary({
        userId,
        name: memberName,
        answerHistory: rawHistory,
        facts,
        memberInfo,
        customCategories,
        familyFeudRounds,
        type: 'regular'
      });

      const regularSummary = result.regularSummary || 'Unable to generate regular summary';
      
      updatedSummary = {
        ...existingSummary,
        regularSummary,
        lastUpdated: now,
        generatedAt: {
          ...existingSummary.generatedAt,
          regular: now
        },
        basicQAs: result.basicQAs || existingSummary.basicQAs || [],
        insights: result.insights || existingSummary.insights || []
      };
      
      logger.info('Regular summary generated successfully');
    } else if (generateRoast) {
      // Only generate roast summary
      logger.info('Generating only roast summary');
      const result = await generateMemberSummary({
        userId,
        name: memberName,
        answerHistory: rawHistory,
        facts,
        memberInfo,
        customCategories,
        familyFeudRounds,
        type: 'roast'
      });
      
      const roastSummary = result.roastSummary || 'Unable to generate roast summary';
      
      updatedSummary = {
        ...existingSummary,
        roastSummary,
        lastUpdated: now,
        generatedAt: {
          ...existingSummary.generatedAt,
          roast: now
        },
        basicQAs: result.basicQAs || existingSummary.basicQAs || [],
        insights: result.insights || existingSummary.insights || []
      };
      
      logger.info('Roast summary generated successfully');
    }
    
    // 7) Save the summaries to S3
    logger.info('Saving member summary to S3', { summaryPath });
    await putJson(summaryPath, updatedSummary);

    // 8) Return the requested mode
    logger.info('Returning generated summary', { mode });
    return successResponse({
      userId,
      summary: mode === 'roast' ? updatedSummary.roastSummary : updatedSummary.regularSummary,
      mode,
      lastUpdated: mode === 'roast' ? updatedSummary.generatedAt.roast : updatedSummary.generatedAt.regular,
      basicQAs: updatedSummary.basicQAs || [],
      insights: updatedSummary.insights || []
    });
    
  } catch (err: any) {
    logger.error('Error fetching/generating member summary', { 
      error: err.message, 
      stack: err.stack 
    });
    return errorResponse('Failed to generate member summary', 500);
  } finally {
    // Clean up any request-specific log context
    logger.removeKeys(['userId', 'mode', 'forceGenerate']);
  }
}

// listObjects helper removed — facts now read from factHistoryService