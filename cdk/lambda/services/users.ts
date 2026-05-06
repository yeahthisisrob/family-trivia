// File: lambda/services/users.ts
import { getJson, listObjects } from './s3';
import { getFactHistory } from './factHistoryService';
import { S3_PATHS } from '../constants';
import { logger } from './logger';
import { getAllCasinoRushSessions } from '../routes/game-modes/casinoRushUtils';

// Types for user configuration
export interface UserConfig {
  group: string;
  color: string;
  passphrase?: string;
  isAdmin?: boolean;
  side?: string;
}

export interface UserConfigData {
  version: string;
  lastUpdated: string;
  users: Record<string, UserConfig>;
}

// Cache for user configuration
let userConfigCache: UserConfigData | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Get user configuration from S3
 */
export async function getUserConfig(): Promise<UserConfigData | null> {
  const now = Date.now();
  
  // Return from cache if valid
  if (userConfigCache && (now - lastCacheTime < CACHE_TTL)) {
    return userConfigCache;
  }
  
  // Get from S3
  try {
    const config = await getJson<UserConfigData>(S3_PATHS.USERS_CONFIG);
    
    if (config) {
      userConfigCache = config;
      lastCacheTime = now;
    }
    
    return config;
  } catch (err) {
    logger.error('Error loading user configuration', { 
      error: err instanceof Error ? err.message : String(err) 
    });
    return null;
  }
}

/**
 * Get user group for a specific user
 */
export async function getUserGroup(userId: string): Promise<string | undefined> {
  const config = await getUserConfig();
  return config?.users[userId]?.group;
}

/**
 * Get all users in a specific group
 */
export async function getUsersInGroup(groupId: string): Promise<string[]> {
  logger.debug('Fetching users for group', { groupId });
  
  const config = await getUserConfig();
  
  if (!config) {
    logger.warn('No user configuration found when fetching users for group', { groupId });
    return [];
  }
  
  const usersInGroup = Object.entries(config.users)
    .filter(([, userData]) => userData.group === groupId)
    .map(([userId]) => userId);
  
  logger.debug('Found users in group', { 
    groupId, 
    userCount: usersInGroup.length,
    users: usersInGroup.join(', ')
  });
  
  return usersInGroup;
}

/**
 * Get all unique group IDs
 */
export async function getAllGroups(): Promise<string[]> {
  const config = await getUserConfig();
  
  if (!config) return [];
  
  return Array.from(new Set(
    Object.values(config.users).map(userData => userData.group)
  ));
}

/**
 * Invalidate the user config cache. Call after admin writes.
 */
export function invalidateUserConfigCache(): void {
  userConfigCache = null;
  lastCacheTime = 0;
  logger.info('User config cache invalidated');
}

/**
 * Check whether a userId has the isAdmin flag
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const config = await getUserConfig();
  return !!(config?.users[userId] as UserConfig | undefined)?.isAdmin;
}

/**
 * Get all user IDs
 */
export async function getAllUsers(): Promise<string[]> {
  const config = await getUserConfig();

  if (!config) return [];

  return Object.keys(config.users);
}

/**
 * Extract YYYY-MM-DD date from a fact S3 key.
 * Keys look like: facts/daily/{userId}/basic_0_2026-03-25.json or shared_2026-03-25.json
 */
function extractDateFromFactKey(key: string): string | null {
  const match = key.match(/(\d{4}-\d{2}-\d{2})\.json$/);
  return match ? match[1] : null;
}

/**
 * Get profile data for multiple users in a single operation.
 * Supports optional date-range filtering to avoid loading all historical data.
 *
 * @param userIds Array of user IDs to fetch profiles for
 * @param options.beforeDate Only include facts on or before this ISO date (YYYY-MM-DD)
 * @param options.afterDate  Only include facts on or after this ISO date  (YYYY-MM-DD)
 * @param options.factLimit  Max facts to fetch per user (applied after date filter, newest first)
 * @returns Object mapping user IDs to their profile data
 */
export async function getUserProfiles(
  userIds: string[],
  options: { beforeDate?: string; afterDate?: string; factLimit?: number } = {},
): Promise<Record<string, any>> {
  // If no users specified, return empty object
  if (!userIds || !userIds.length) return {};

  // Initialize result object
  const userProfiles: Record<string, any> = {};

  // Create arrays of promises for parallel execution
  const profilePromises = userIds.map(async (userId) => {
    try {
      // Load profile from S3
      const rawHistory = await getJson<any[]>(S3_PATHS.ANSWER_HISTORY(userId));
      
      // Get Casino Rush history using utility (checks both old and new paths)
      let casinoHistory = [];
      try {
        const sessions = await getAllCasinoRushSessions(userId);
        
        // Process each session
        for (const session of sessions) {
          const sessionEntries = processSessionQuestions(session, userId);
          casinoHistory.push(...sessionEntries);
        }
      } catch (e) {
        logger.debug('Error getting casino rush sessions for user', { 
          userId, 
          error: e instanceof Error ? e.message : String(e) 
        });
      }
      
      // Helper function to process session questions
      function processSessionQuestions(session: any, userId: string) {
        if (!session.questions || !Array.isArray(session.questions)) return [];
        
        // Casino Rush only awards points if ALL questions are correct (status = 'completed')
        const isCompleted = session.status === 'completed';
        const allCorrect = session.questions.every((q: any) => q.correct === true);
        const totalSessionPoints = isCompleted && allCorrect && session.potentialPoints ? session.potentialPoints : 0;
        // Divide points evenly among questions to avoid triple counting
        const pointsPerQuestion = totalSessionPoints > 0 ? totalSessionPoints / session.questions.length : 0;
        
        return session.questions
          .filter((q: any) => q && typeof q === 'object' && q.answeredAt)
          .map((q: any, index: number) => {
            try {
              const entry = {
                question: {
                  ...q,
                  mode: 'casino-rush',
                  pointMultiplier: 3
                },
                selectedAnswer: q.userAnswer || '',
                correct: !!q.correct,
                timestamp: new Date(q.answeredAt).toISOString(),
                pointsEarned: q.correct && isCompleted && allCorrect ? pointsPerQuestion : 0,
                isCasinoRush: true,
                questionNumber: index + 1,
                totalQuestions: session.questions.length,
              };
              return entry;
            } catch (mapError) {
              logger.error('Error processing casino rush question', { 
                userId, 
                questionIndex: index, 
                error: mapError instanceof Error ? mapError.message : String(mapError)
              });
              // Return a safe default entry
              return {
                question: {
                  question: "Casino Rush Question",
                  choices: ["A", "B", "C", "D"],
                  answer: "A",
                  mode: 'casino-rush',
                  pointMultiplier: 3
                },
                selectedAnswer: "",
                correct: false,
                timestamp: new Date().toISOString(),
                pointsEarned: 0,
                isCasinoRush: true,
                questionNumber: index + 1,
                totalQuestions: session.questions.length,
              };
            }
          });
      }
      
      // Get slot machine sessions
      let slotMachineHistory: any[] = [];
      try {
        const slotSession = await getJson<any>(`slot-machine/${userId}/session.json`);
        if (slotSession && slotSession.question && slotSession.question.answeredAt) {
          // Create a timeline entry for slot machine
          slotMachineHistory = [{
            question: {
              ...slotSession.question,
              mode: 'slot-machine',
              pointMultiplier: slotSession.result?.multiplier || 1
            },
            selectedAnswer: slotSession.question.userAnswer || '',
            correct: !!slotSession.question.correct,
            timestamp: new Date(slotSession.question.answeredAt).toISOString(),
            pointsEarned: slotSession.question.pointsEarned || 0,
            isSlotMachine: true,
            multiplier: slotSession.result?.multiplier || 1,
          }];
        }
      } catch (e) {
        logger.debug('No slot machine session for user', { userId });
        // No slot machine session
      }
      
      // Combine histories and sort by timestamp (newest first)
      const history = [...(rawHistory || []), ...(casinoHistory || []), ...(slotMachineHistory || [])]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Get facts from consolidated history
      let factEntries = await getFactHistory(userId);

      // Filter by date range
      if (options.beforeDate || options.afterDate) {
        factEntries = factEntries.filter(e => {
          if (options.beforeDate && e.date > options.beforeDate) return false;
          if (options.afterDate && e.date < options.afterDate) return false;
          return true;
        });
      }

      // Sort newest first and apply limit
      const perUserLimit = options.factLimit || 1000;
      const facts = factEntries
        .filter(e => e.answered && e.question && e.answer)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, perUserLimit)
        .map(e => ({ ...e, questionType: e.questionType || 'basic' }));
      return {
        userId,
        profileData: {
          history,
          facts: facts || []
        }
      };
    } catch (err) {
      logger.error('Error loading profile for user', { 
        userId, 
        error: err instanceof Error ? err.message : String(err) 
      });
      // Return empty profile data
      return {
        userId,
        profileData: {
          profile: {},
          history: [],
          streak: 0,
          facts: [],
          categorySelections: [],
          difficultyStats: { easy: 0, normal: 0, hard: 0, total: 0 },
          totalScore: 0,
          lastUpdated: new Date().toISOString()
        }
      };
    }
  });

  // Wait for all promises to resolve
  const results = await Promise.all(profilePromises);

  // Process results
  results.forEach(({ userId, profileData }) => {
    if (profileData) {
      userProfiles[userId] = profileData;
    }
  });

  return userProfiles;
}