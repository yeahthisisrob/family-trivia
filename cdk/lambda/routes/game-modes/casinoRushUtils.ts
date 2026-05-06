// File: lambda/routes/game-modes/casinoRushUtils.ts
// Purpose: Utility functions for Casino Rush game mode with backwards compatibility

import { getJson, listObjects } from '../../services/s3';
import { logger } from '../../services/logger';
import { CasinoRushInternalSession } from '@family-trivia/shared';

/** Backend Casino Rush session with optional sessionId for tracking */
export interface CasinoRushSession extends CasinoRushInternalSession {
  sessionId?: string;
}

/** Backend-specific history entry for cooldown tracking (differs from shared CasinoRushHistoryEntry) */
export interface CasinoRushHistoryEntry {
  sessionId: string;
  completedAt: number;
  score: number;
  difficulty: string;
  questionsAnswered: number;
}

/**
 * Get all Casino Rush sessions for a user (both old and new format)
 * This provides backwards compatibility during migration
 */
export async function getAllCasinoRushSessions(userId: string): Promise<CasinoRushSession[]> {
  const sessions: CasinoRushSession[] = [];
  
  try {
    // Check old path first (for backwards compatibility)
    const oldSessionPath = `casino-rush/${userId}/session.json`;
    const oldSession = await getJson<CasinoRushSession>(oldSessionPath);
    
    if (oldSession && oldSession.questions && oldSession.questions.length > 0) {
      // Check if any questions were answered
      const hasAnsweredQuestions = oldSession.questions.some(q => q.answeredAt !== undefined);
      if (hasAnsweredQuestions) {
        logger.debug(`Found old Casino Rush session for ${userId}`);
        sessions.push(oldSession);
      }
    }
  } catch (err) {
    // Old session doesn't exist, which is fine
    logger.debug(`No old Casino Rush session for ${userId}`);
  }
  
  try {
    // Check new current session
    const currentSessionPath = `casino-rush/${userId}/current-session.json`;
    const currentSession = await getJson<CasinoRushSession>(currentSessionPath);
    
    if (currentSession && currentSession.questions && currentSession.questions.length > 0) {
      // Check if any questions were answered
      const hasAnsweredQuestions = currentSession.questions.some(q => q.answeredAt !== undefined);
      if (hasAnsweredQuestions) {
        logger.debug(`Found current Casino Rush session for ${userId}`);
        sessions.push(currentSession);
      }
    }
  } catch (err) {
    logger.debug(`No current Casino Rush session for ${userId}`);
  }
  
  try {
    // List all files in sessions/ directory directly — history.json can be
    // missing or corrupted, so listing is the reliable fallback.
    const sessionsPrefix = `casino-rush/${userId}/sessions/`;
    const sessionFiles = await listObjects(sessionsPrefix);

    for (const sessionFile of sessionFiles) {
      try {
        const session = await getJson<CasinoRushSession>(sessionFile);
        if (session && session.questions && session.questions.length > 0) {
          const hasAnsweredQuestions = session.questions.some(q => q.answeredAt !== undefined);
          if (hasAnsweredQuestions) {
            sessions.push(session);
          }
        }
      } catch (err) {
        logger.debug(`Could not load session file ${sessionFile} for user ${userId}`);
      }
    }
  } catch (err) {
    logger.debug(`No Casino Rush sessions directory for ${userId}`);
  }
  
  // Deduplicate sessions by startTime — the same session can exist in
  // multiple S3 paths (old session.json, current-session.json, archived sessions/).
  const seen = new Set<number>();
  const unique: CasinoRushSession[] = [];
  for (const s of sessions) {
    const key = s.startTime || 0;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }

  return unique;
}

/**
 * Check if user has played Casino Rush today (checks both old and new paths)
 */
export async function hasPlayedCasinoRushToday(userId: string, todayET: string): Promise<boolean> {
  const sessions = await getAllCasinoRushSessions(userId);
  
  for (const session of sessions) {
    if (session.questions) {
      for (const question of session.questions) {
        if (question.answeredAt) {
          const answerDate = new Date(question.answeredAt);
          const answerDateET = new Date(answerDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
          const answerDateString = `${answerDateET.getFullYear()}-${String(answerDateET.getMonth() + 1).padStart(2, '0')}-${String(answerDateET.getDate()).padStart(2, '0')}`;
          
          if (answerDateString === todayET) {
            logger.info(`User ${userId} played Casino Rush today`);
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

/**
 * Get active Casino Rush session (checks both old and new paths)
 */
export async function getActiveCasinoRushSession(userId: string): Promise<CasinoRushSession | null> {
  // Check new path first
  try {
    const currentSessionPath = `casino-rush/${userId}/current-session.json`;
    const currentSession = await getJson<CasinoRushSession>(currentSessionPath);
    
    if (currentSession && currentSession.status === 'active') {
      return currentSession;
    }
  } catch (err) {
    logger.debug(`No current active session for ${userId}`);
  }
  
  // Check old path for backwards compatibility
  try {
    const oldSessionPath = `casino-rush/${userId}/session.json`;
    const oldSession = await getJson<CasinoRushSession>(oldSessionPath);
    
    if (oldSession && oldSession.status === 'active') {
      logger.info(`Found active session in old path for ${userId}, will use it`);
      return oldSession;
    }
  } catch (err) {
    logger.debug(`No old active session for ${userId}`);
  }
  
  return null;
}