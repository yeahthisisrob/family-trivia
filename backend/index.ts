// File: lambda/index.ts
import type { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { CORS_HEADERS, jsonResponse } from './config';
import { requireAuth } from './middleware/requireAuth';

// Routes where `userId` names the person being looked at, not the caller.
const SUBJECT = { userId: 'subject' } as const;

// Admin endpoints
import { appearanceRoutes } from './features/appearance/routes';
import { archiveRoutes } from './features/archive/routes';
import { backupsRoutes } from './features/backups/routes';
import { commentsRoutes } from './features/comments/routes';
import { familyRoutes } from './features/family/routes';
import { fillInRoutes } from './features/fill-in/routes';
import { graphRoutes } from './features/graph/routes';
import { knowledgeRoutes } from './features/knowledge/routes';
import { lookBackRoutes } from './features/look-back/routes';
import { personStoryRoutes } from './features/person-story/routes';
import { reactionsRoutes } from './features/reactions/routes';
import { settingsRoutes } from './features/settings/routes';
import * as adminHandlers from './routes/admin';
// Answer grid for trivia status matrix
import { getAnswerGrid } from './routes/answerGrid';
// App init endpoint (consolidated)
import { appInit, appInitDeferred } from './routes/appInit';
// Arcade endpoints
import { arcadeLeaderboard, arcadeSubmitScore } from './routes/arcade';
// Auth
import { authGoogle } from './routes/authGoogle';
import { canAnswerQuestion } from './routes/canAnswerQuestion';
// Casino (shared credit pool)
import { getCasinoBalance, updateCasinoBalance } from './routes/casino';

// New catchup status endpoint
import { getCatchupStatus } from './routes/catchupStatus';
// Celebrations endpoints
import { addCelebration, deleteCelebration, getCelebrations } from './routes/celebrations';
// Consolidated leaderboard endpoint
import { getConsolidatedLeaderboard } from './routes/consolidatedLeaderboard';
// Custom category endpoints
import { createCustomCategory } from './routes/createCustomCategory';
import { generateCrossword } from './routes/crossword';
// Daily fact endpoints
import {
  getDailyFact,
  getDailyFactCategories,
  getDailyFactOptions,
  getRecentSharedQuestions,
  getUserFactHistory,
  submitDailyFact,
  submitHistoricalFact,
} from './routes/dailyFact';
// End of season endpoint
import { endOfSeasonStatus } from './routes/endOfSeasonStatus';
// Fact grid for daily fact status matrix
import { getFactGrid } from './routes/factGrid';
// Fact suggestions for autocomplete
import { getFactSuggestions } from './routes/factSuggestions';
// Family Feud endpoints
import {
  adminGetFamilyFeud,
  adminResetFamilyFeud,
  familyFeudAnswer,
  familyFeudGuess,
  familyFeudPass,
  familyFeudStartRound,
  familyFeudStatus,
} from './routes/familyFeud';
// Family hierarchy endpoint
import { getFamilyHierarchy } from './routes/familyHierarchy';
// Casino Rush endpoints
import {
  casinoRushStartGame,
  casinoRushStatus,
  casinoRushSubmitAnswer,
} from './routes/game-modes/casinoRush';
// Curling endpoints
import { curlingAnswer, curlingLock, curlingStatus } from './routes/game-modes/curling';
// Slot Machine endpoints
import {
  slotMachineAnswer,
  slotMachineArcadeSpin,
  slotMachineBalance,
  slotMachineQuestion,
  slotMachineSpin,
  slotMachineStatus,
} from './routes/game-modes/slotMachine';
// Tetris endpoints
import { tetrisAnswer, tetrisLock, tetrisStatus } from './routes/game-modes/tetris';
// Game AI (shared Haiku strategy for arcade games)
import { gameAIMove } from './routes/gameAI';
import { generateQuestion } from './routes/generateQuestion';
// Question options endpoint
import { generateQuestionOptions } from './routes/generateQuestionOptions';
import { getCategories } from './routes/getCategories';
// User configuration endpoint
import { getUserConfig } from './routes/getUserConfig';
// Group description endpoints
import { getGroupDescriptions, updateGroupDescription } from './routes/groupDescription';
import { leaderboard } from './routes/leaderboard';
import { listMembers } from './routes/listMembers';
// Member spotlight summary endpoint
import { getMemberSummary } from './routes/memberSummary';
// Notification endpoints
import {
  getNotificationsHandler,
  markAllReadHandler,
  markReadHandler,
} from './routes/notifications';
// Photo albums (links to external shared albums, admin-managed)
import {
  addPhotoAlbum,
  deletePhotoAlbum,
  listPhotoAlbums,
  updatePhotoAlbum,
} from './routes/photoAlbums';
// Step pipeline endpoints
import { step1Generate } from './routes/questionGeneration/step1Generate';
import { step2CheckDuplicates } from './routes/questionGeneration/step2CheckDuplicates';
import { step3FactCheck } from './routes/questionGeneration/step3FactCheck';
// Question status endpoints
import { questionStatus } from './routes/questionStatus';
// Weekly fact summary endpoint
import { markSeasonLetterSeen } from './routes/seasonLetters';
import { getSnakeQuestions } from './routes/snake';
import { submitAnswer } from './routes/submitAnswer';
import { submitCustomCategory } from './routes/submitCustomCategory';
import { suggestGroupDescription } from './routes/suggestGroupDescription';
import { getSystemInfo } from './routes/systemInfo';
// Timeline data for fact and trivia timelines
import { getTimelineData } from './routes/timelineData';
// Trivia Bank admin endpoints
import {
  triviaBankBrowse,
  triviaBankDelete,
  triviaBankImport,
  triviaBankStats,
} from './routes/triviaBankAdmin';
// Upcoming birthdays endpoint
import { getUpcomingBirthdays } from './routes/upcomingBirthdays';
import { userProfile } from './routes/userProfile';
import { getWeeklyFactSummary } from './routes/weeklyFactSummary';
import { loadModelChoices } from './services/bedrock/core/models';
import { flushUsage } from './services/bedrock/core/usage';
import { invalidateFactHistoryCache } from './services/factHistoryService';
import { invalidateGameModeCache } from './services/gameModeService';
import { logger } from './services/logger';
// Cache invalidation — must clear per-request to prevent stale data on warm Lambdas
import { invalidatePlayerStateCache } from './services/playerStateService';
import { invalidateS3ReadCache } from './services/s3';

const routes: Record<string, (event: any) => Promise<APIGatewayProxyResult>> = {
  // ── Feature slices (backend/features/*) ─────────────────────
  ...familyRoutes,
  ...appearanceRoutes,
  ...archiveRoutes,
  ...graphRoutes,
  ...settingsRoutes,
  ...reactionsRoutes,
  ...fillInRoutes,
  ...backupsRoutes,
  ...knowledgeRoutes,
  ...commentsRoutes,
  ...personStoryRoutes,
  ...lookBackRoutes,

  // ── Public (no auth) ─────────────────────────────────────────
  'POST /auth/google': authGoogle,

  // ── Protected: identity comes from the token (middleware/requireAuth.ts) ──
  'GET /members': requireAuth(listMembers),
  'POST /submit-answer': requireAuth(submitAnswer),
  'GET /daily-fact': requireAuth(getDailyFact),
  'POST /daily-fact': requireAuth(getDailyFact),
  'POST /submit-daily-fact': requireAuth(submitDailyFact),
  'GET /daily-fact-categories': requireAuth(getDailyFactCategories),
  'POST /daily-fact-options': requireAuth(getDailyFactOptions),
  'POST /generate-question-options': requireAuth(generateQuestionOptions),
  'GET /recent-shared-questions': requireAuth(getRecentSharedQuestions),
  'GET /user-fact-history': requireAuth(getUserFactHistory, SUBJECT),
  'POST /submit-historical-fact': requireAuth(submitHistoricalFact),
  'GET /leaderboard': requireAuth(leaderboard),
  'GET /user-profile': requireAuth(userProfile, SUBJECT),
  'POST /generate-question': requireAuth(generateQuestion),
  'GET /notifications': requireAuth(getNotificationsHandler),
  'POST /notifications/mark-read': requireAuth(markReadHandler),
  'POST /notifications/mark-all-read': requireAuth(markAllReadHandler),
  'POST /question-gen/step1': requireAuth(step1Generate),
  'POST /question-gen/step2': requireAuth(step2CheckDuplicates),
  'POST /question-gen/step3': requireAuth(step3FactCheck),
  'GET /catchup-status': requireAuth(getCatchupStatus),
  'GET /question-status': requireAuth(questionStatus),
  'GET /can-answer-question': requireAuth(canAnswerQuestion),
  'GET /end-of-season-status': requireAuth(endOfSeasonStatus),
  'POST /season-letters/seen': requireAuth(markSeasonLetterSeen),
  'GET /app-init': requireAuth(appInit),
  'GET /app-init-deferred': requireAuth(appInitDeferred),
  'GET /fact-suggestions': requireAuth(getFactSuggestions),
  'POST /create-custom-category': requireAuth(createCustomCategory),
  'POST /submit-custom-category': requireAuth(submitCustomCategory),
  'GET /categories': requireAuth(getCategories),
  'GET /group-description': requireAuth(getGroupDescriptions),
  'POST /update-group-description': requireAuth(updateGroupDescription),
  'POST /suggest-group-description': requireAuth(suggestGroupDescription),
  'GET /family-hierarchy': requireAuth(getFamilyHierarchy),
  'GET /member-summary': requireAuth(getMemberSummary, SUBJECT),
  'GET /daily-fact-summary': requireAuth(getWeeklyFactSummary),
  'GET /user-config': requireAuth(getUserConfig),
  'GET /timeline-data': requireAuth(getTimelineData),
  'GET /consolidated-leaderboard': requireAuth(getConsolidatedLeaderboard),
  'GET /answer-grid': requireAuth(getAnswerGrid),
  'GET /fact-grid': requireAuth(getFactGrid),
  'POST /casino-rush/start': requireAuth(casinoRushStartGame),
  'POST /casino-rush/answer': requireAuth(casinoRushSubmitAnswer),
  'GET /casino-rush/status': requireAuth(casinoRushStatus),
  'POST /slot-machine/spin': requireAuth(slotMachineSpin),
  'POST /slot-machine/question': requireAuth(slotMachineQuestion),
  'POST /slot-machine/answer': requireAuth(slotMachineAnswer),
  'GET /slot-machine/status': requireAuth(slotMachineStatus),
  'POST /slot-machine/arcade-spin': requireAuth(slotMachineArcadeSpin),
  'GET /slot-machine/balance': requireAuth(slotMachineBalance),
  'GET /curling/status': requireAuth(curlingStatus),
  'POST /curling/lock': requireAuth(curlingLock),
  'POST /curling/answer': requireAuth(curlingAnswer),
  'GET /tetris/status': requireAuth(tetrisStatus),
  'POST /tetris/lock': requireAuth(tetrisLock),
  'POST /tetris/answer': requireAuth(tetrisAnswer),
  'GET /arcade/leaderboard': requireAuth(arcadeLeaderboard),
  'POST /arcade/submit-score': requireAuth(arcadeSubmitScore),
  'POST /crossword/generate': requireAuth(generateCrossword),
  'POST /snake/questions': requireAuth(getSnakeQuestions),
  'GET /family-feud/status': requireAuth(familyFeudStatus),
  'POST /family-feud/start-round': requireAuth(familyFeudStartRound),
  'POST /family-feud/answer': requireAuth(familyFeudAnswer),
  'POST /family-feud/guess': requireAuth(familyFeudGuess),
  'POST /family-feud/pass': requireAuth(familyFeudPass),
  'GET /upcoming-birthdays': requireAuth(getUpcomingBirthdays),
  'POST /celebrations': requireAuth(addCelebration),
  'GET /celebrations': requireAuth(getCelebrations),
  'DELETE /celebrations': requireAuth(deleteCelebration),
  'POST /game-ai/move': requireAuth(gameAIMove),
  'GET /casino/balance': requireAuth(getCasinoBalance),
  'POST /casino/balance': requireAuth(updateCasinoBalance),
  'GET /photo-albums': requireAuth(listPhotoAlbums),
  'POST /photo-albums': requireAuth(addPhotoAlbum),
  'PUT /photo-albums': requireAuth(updatePhotoAlbum),
  'DELETE /photo-albums': requireAuth(deletePhotoAlbum),

  // Admin routes — all require auth
  'GET /admin/players': requireAuth(adminHandlers.getPlayers, SUBJECT),
  'POST /admin/players': requireAuth(adminHandlers.addPlayer, SUBJECT),
  'PUT /admin/players': requireAuth(adminHandlers.updatePlayer, SUBJECT),
  'DELETE /admin/players': requireAuth(adminHandlers.deletePlayer, SUBJECT),
  'GET /admin/groups': requireAuth(adminHandlers.getGroups, SUBJECT),
  'POST /admin/groups': requireAuth(adminHandlers.addGroup, SUBJECT),
  'PUT /admin/groups': requireAuth(adminHandlers.updateGroup, SUBJECT),
  'DELETE /admin/groups': requireAuth(adminHandlers.deleteGroup, SUBJECT),
  'GET /admin/family-tree': requireAuth(adminHandlers.getFamilyTree, SUBJECT),
  'PUT /admin/family-tree': requireAuth(adminHandlers.updateFamilyTree, SUBJECT),
  'GET /admin/seasons': requireAuth(adminHandlers.getSeasons, SUBJECT),
  'POST /admin/media/upload-url': requireAuth(adminHandlers.getMediaUploadUrl, SUBJECT),
  'GET /admin/media/url': requireAuth(adminHandlers.getMediaReadUrl, SUBJECT),
  'POST /admin/seasons': requireAuth(adminHandlers.addSeason, SUBJECT),
  'PUT /admin/seasons': requireAuth(adminHandlers.updateSeason, SUBJECT),
  'DELETE /admin/seasons': requireAuth(adminHandlers.deleteSeason, SUBJECT),
  'GET /admin/user-facts': requireAuth(adminHandlers.getUserFacts, SUBJECT),
  'PUT /admin/user-facts': requireAuth(adminHandlers.updateUserFact, SUBJECT),
  'DELETE /admin/user-facts': requireAuth(adminHandlers.deleteUserFact, SUBJECT),
  'GET /admin/user-trivia': requireAuth(adminHandlers.getUserTrivia, SUBJECT),
  'DELETE /admin/user-trivia': requireAuth(adminHandlers.deleteUserTrivia, SUBJECT),
  'GET /admin/game-sessions': requireAuth(adminHandlers.getGameSessions, SUBJECT),
  'DELETE /admin/game-sessions': requireAuth(adminHandlers.resetGameSession, SUBJECT),
  'GET /admin/daily-questions': requireAuth(adminHandlers.getDailyQuestions, SUBJECT),
  'DELETE /admin/daily-questions': requireAuth(adminHandlers.deleteDailyQuestion, SUBJECT),
  'GET /admin/trivia-bank/stats': requireAuth(triviaBankStats, SUBJECT),
  'GET /admin/trivia-bank/browse': requireAuth(triviaBankBrowse, SUBJECT),
  'DELETE /admin/trivia-bank/question': requireAuth(triviaBankDelete, SUBJECT),
  'POST /admin/trivia-bank/import': requireAuth(triviaBankImport, SUBJECT),
  'GET /admin/family-feud': requireAuth(adminGetFamilyFeud, SUBJECT),
  'DELETE /admin/family-feud': requireAuth(adminResetFamilyFeud, SUBJECT),
  'GET /admin/system-info': requireAuth(getSystemInfo, SUBJECT),
};

export const handler: APIGatewayProxyHandler = async (event) => {
  // Clear per-invocation caches to prevent stale data on warm Lambda containers
  invalidateS3ReadCache();
  invalidatePlayerStateCache();
  invalidateGameModeCache();
  invalidateFactHistoryCache();

  // Add request context to logger
  logger.appendKeys({
    requestId: event.requestContext?.requestId,
    path: event.path,
    method: event.httpMethod,
    sourceIp: event.requestContext?.identity?.sourceIp,
  });

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  // normalize path (strip /api prefix from CloudFront, collapse slashes)
  let path = event.path
    .replace(/^\/prod\/?/, '/') // REST API stage prefix (legacy, safe no-op for HTTP API)
    .replace(/^\/api\/?/, '/') // CloudFront /api/* behavior prefix
    .replace(/\/\/+/g, '/');
  if (path === '/') path = '';

  const key = `${event.httpMethod.toUpperCase()} ${path}`;
  logger.info('Received API request', { route: key });

  const fn = routes[key];
  if (!fn) {
    logger.warn('Route not found', { route: key });
    return jsonResponse({ error: 'Route not found' }, 404);
  }

  try {
    await loadModelChoices();
    return await fn(event);
  } catch (err: any) {
    logger.error('Unhandled error in route', {
      route: key,
      error: err.message,
      stack: err.stack,
    });
    return jsonResponse(
      {
        error: 'Internal server error',
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      },
      500,
    );
  } finally {
    // One write per request for whatever the AI used (services/bedrock/core/usage.ts).
    await flushUsage();
  }
};
