// File: lambda/index.ts
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { CORS_HEADERS, jsonResponse } from './config';
import { logger } from './services/logger';

// Import your route-handlers
import { validatePassphrase }   from './routes/validatePassphrase';
import { listMembers }          from './routes/listMembers';
import { submitAnswer }         from './routes/submitAnswer';
import { leaderboard }          from './routes/leaderboard';
import { userProfile }          from './routes/userProfile';
import { generateQuestion }     from './routes/generateQuestion';

// Daily fact endpoints
import { getDailyFact, submitDailyFact, getRecentSharedQuestions, getUserFactHistory, submitHistoricalFact, getDailyFactCategories, getDailyFactOptions } from './routes/dailyFact';

// New catchup status endpoint
import { getCatchupStatus }    from './routes/catchupStatus';

// Step pipeline endpoints
import { step1Generate } from './routes/questionGeneration/step1Generate';
import { step2CheckDuplicates } from './routes/questionGeneration/step2CheckDuplicates';
import { step3FactCheck } from './routes/questionGeneration/step3FactCheck';

// Notification endpoints
import { getNotificationsHandler, markReadHandler, markAllReadHandler } from './routes/notifications';

// Question status endpoints
import { questionStatus }      from './routes/questionStatus';
import { canAnswerQuestion }   from './routes/canAnswerQuestion';

// Custom category endpoints
import { createCustomCategory } from './routes/createCustomCategory';
import { submitCustomCategory } from './routes/submitCustomCategory';
import { getCategories } from './routes/getCategories';

// Group description endpoints
import { getGroupDescriptions, updateGroupDescription } from './routes/groupDescription';
import { suggestGroupDescription } from './routes/suggestGroupDescription';

// Family hierarchy endpoint
import { getFamilyHierarchy } from './routes/familyHierarchy';

// Member spotlight summary endpoint
import { getMemberSummary } from './routes/memberSummary';

// Weekly fact summary endpoint
import { getWeeklyFactSummary } from './routes/weeklyFactSummary';

// User configuration endpoint
import { getUserConfig } from './routes/getUserConfig';

// Timeline data for fact and trivia timelines
import { getTimelineData } from './routes/timelineData';

// Consolidated leaderboard endpoint
import { getConsolidatedLeaderboard } from './routes/consolidatedLeaderboard';

// Unified comments endpoints
import { getCommentsHandler, getCommentCountsHandler, addCommentHandler } from './routes/comments';

// Casino Rush endpoints
import { casinoRushStartGame, casinoRushSubmitAnswer, casinoRushStatus } from './routes/game-modes/casinoRush';

// Slot Machine endpoints
import { slotMachineSpin, slotMachineQuestion, slotMachineAnswer, slotMachineStatus, slotMachineArcadeSpin, slotMachineBalance } from './routes/game-modes/slotMachine';

// Curling endpoints
import { curlingStatus, curlingLock, curlingAnswer } from './routes/game-modes/curling';

// Tetris endpoints
import { tetrisStatus, tetrisLock, tetrisAnswer } from './routes/game-modes/tetris';

// Arcade endpoints
import { arcadeLeaderboard, arcadeSubmitScore } from './routes/arcade';
import { generateCrossword } from './routes/crossword';
import { getSnakeQuestions } from './routes/snake';

// Auth
import { authGoogle } from './routes/authGoogle';
import { requireAuth } from './middleware/requireAuth';

// Trivia Bank admin endpoints
import { triviaBankStats, triviaBankBrowse, triviaBankDelete, triviaBankImport } from './routes/triviaBankAdmin';

// Family Feud endpoints
import { familyFeudStatus, familyFeudStartRound, familyFeudAnswer, familyFeudGuess, familyFeudPass, adminGetFamilyFeud, adminResetFamilyFeud } from './routes/familyFeud';

// Upcoming birthdays endpoint
import { getUpcomingBirthdays } from './routes/upcomingBirthdays';

// Celebrations endpoints
import { addCelebration, getCelebrations, deleteCelebration } from './routes/celebrations';

// Photo albums (links to external shared albums, admin-managed)
import { listPhotoAlbums, addPhotoAlbum, updatePhotoAlbum, deletePhotoAlbum } from './routes/photoAlbums';

// Casino (shared credit pool)
import { getCasinoBalance, updateCasinoBalance } from './routes/casino';

// Game AI (shared Haiku strategy for arcade games)
import { gameAIMove } from './routes/gameAI';


// Question options endpoint
import { generateQuestionOptions } from './routes/generateQuestionOptions';

// End of season endpoint
import { endOfSeasonStatus } from './routes/endOfSeasonStatus';

// App init endpoint (consolidated)
import { appInit, appInitDeferred } from './routes/appInit';

// Answer grid for trivia status matrix
import { getAnswerGrid } from './routes/answerGrid';

// Fact grid for daily fact status matrix
import { getFactGrid } from './routes/factGrid';

// Fact suggestions for autocomplete
import { getFactSuggestions } from './routes/factSuggestions';

// Admin endpoints
import * as adminHandlers from './routes/admin';
import { getSystemInfo } from './routes/systemInfo';

// Cache invalidation — must clear per-request to prevent stale data on warm Lambdas
import { invalidatePlayerStateCache } from './services/playerStateService';
import { invalidateFactHistoryCache } from './services/factHistoryService';
import { invalidateGameModeCache } from './services/gameModeService';
import { invalidateS3ReadCache } from './services/s3';

const routes: Record<string, (event: any) => Promise<APIGatewayProxyResult>> = {
  // ── Public (no auth) ─────────────────────────────────────────
  'POST /validate-passphrase':   validatePassphrase,
  'POST /auth/google':           authGoogle,
  'GET /members':                listMembers,

  // ── Protected (JWT required, migration fallback for userId) ──
  'POST /submit-answer':         requireAuth(submitAnswer),
  'GET /daily-fact':             requireAuth(getDailyFact),
  'POST /daily-fact':            requireAuth(getDailyFact),
  'POST /submit-daily-fact':     requireAuth(submitDailyFact),
  'GET /daily-fact-categories':  requireAuth(getDailyFactCategories),
  'POST /daily-fact-options':    requireAuth(getDailyFactOptions),
  'POST /generate-question-options': requireAuth(generateQuestionOptions),
  'GET /recent-shared-questions': requireAuth(getRecentSharedQuestions),
  'GET /user-fact-history':      requireAuth(getUserFactHistory),
  'POST /submit-historical-fact': requireAuth(submitHistoricalFact),
  'GET /leaderboard':            requireAuth(leaderboard),
  'GET /user-profile':           requireAuth(userProfile),
  'POST /generate-question':     requireAuth(generateQuestion),
  'GET /notifications':          requireAuth(getNotificationsHandler),
  'POST /notifications/mark-read': requireAuth(markReadHandler),
  'POST /notifications/mark-all-read': requireAuth(markAllReadHandler),
  'POST /question-gen/step1':    requireAuth(step1Generate),
  'POST /question-gen/step2':    requireAuth(step2CheckDuplicates),
  'POST /question-gen/step3':    requireAuth(step3FactCheck),
  'GET /catchup-status':         requireAuth(getCatchupStatus),
  'GET /question-status':        requireAuth(questionStatus),
  'GET /can-answer-question':    requireAuth(canAnswerQuestion),
  'GET /end-of-season-status':   requireAuth(endOfSeasonStatus),
  'GET /app-init':               requireAuth(appInit),
  'GET /app-init-deferred':      requireAuth(appInitDeferred),
  'GET /fact-suggestions':       requireAuth(getFactSuggestions),
  'POST /create-custom-category': requireAuth(createCustomCategory),
  'POST /submit-custom-category': requireAuth(submitCustomCategory),
  'GET /categories':             requireAuth(getCategories),
  'GET /group-description':      requireAuth(getGroupDescriptions),
  'POST /update-group-description': requireAuth(updateGroupDescription),
  'POST /suggest-group-description': requireAuth(suggestGroupDescription),
  'GET /family-hierarchy':       requireAuth(getFamilyHierarchy),
  'GET /member-summary':        requireAuth(getMemberSummary),
  'GET /daily-fact-summary':    requireAuth(getWeeklyFactSummary),
  'GET /user-config':           requireAuth(getUserConfig),
  'GET /timeline-data':         requireAuth(getTimelineData),
  'GET /consolidated-leaderboard': requireAuth(getConsolidatedLeaderboard),
  'GET /answer-grid':              requireAuth(getAnswerGrid),
  'GET /fact-grid':                requireAuth(getFactGrid),
  'GET /comments':              requireAuth(getCommentsHandler),
  'GET /comments/counts':       requireAuth(getCommentCountsHandler),
  'POST /comments':             requireAuth(addCommentHandler),
  // Legacy aliases (backwards compat during migration)
  'GET /fact-comments':         requireAuth(getCommentsHandler),
  'POST /fact-comments':        requireAuth(addCommentHandler),
  'GET /trivia-comments':       requireAuth(getCommentsHandler),
  'POST /trivia-comments':      requireAuth(addCommentHandler),
  'POST /casino-rush/start':    requireAuth(casinoRushStartGame),
  'POST /casino-rush/answer':   requireAuth(casinoRushSubmitAnswer),
  'GET /casino-rush/status':    requireAuth(casinoRushStatus),
  'POST /slot-machine/spin':    requireAuth(slotMachineSpin),
  'POST /slot-machine/question': requireAuth(slotMachineQuestion),
  'POST /slot-machine/answer':  requireAuth(slotMachineAnswer),
  'GET /slot-machine/status':   requireAuth(slotMachineStatus),
  'POST /slot-machine/arcade-spin': requireAuth(slotMachineArcadeSpin),
  'GET /slot-machine/balance':  requireAuth(slotMachineBalance),
  'GET /curling/status':        requireAuth(curlingStatus),
  'POST /curling/lock':         requireAuth(curlingLock),
  'POST /curling/answer':       requireAuth(curlingAnswer),
  'GET /tetris/status':         requireAuth(tetrisStatus),
  'POST /tetris/lock':          requireAuth(tetrisLock),
  'POST /tetris/answer':        requireAuth(tetrisAnswer),
  'GET /arcade/leaderboard':    requireAuth(arcadeLeaderboard),
  'POST /arcade/submit-score':  requireAuth(arcadeSubmitScore),
  'POST /crossword/generate':   requireAuth(generateCrossword),
  'POST /snake/questions':      requireAuth(getSnakeQuestions),
  'GET /family-feud/status':     requireAuth(familyFeudStatus),
  'POST /family-feud/start-round': requireAuth(familyFeudStartRound),
  'POST /family-feud/answer':    requireAuth(familyFeudAnswer),
  'POST /family-feud/guess':     requireAuth(familyFeudGuess),
  'POST /family-feud/pass':      requireAuth(familyFeudPass),
  'GET /upcoming-birthdays':    requireAuth(getUpcomingBirthdays),
  'POST /celebrations':         requireAuth(addCelebration),
  'GET /celebrations':          requireAuth(getCelebrations),
  'DELETE /celebrations':       requireAuth(deleteCelebration),
  'POST /game-ai/move':          requireAuth(gameAIMove),
  'GET /casino/balance':         requireAuth(getCasinoBalance),
  'POST /casino/balance':        requireAuth(updateCasinoBalance),
  'GET /photo-albums':          requireAuth(listPhotoAlbums),
  'POST /photo-albums':         requireAuth(addPhotoAlbum),
  'PUT /photo-albums':          requireAuth(updatePhotoAlbum),
  'DELETE /photo-albums':       requireAuth(deletePhotoAlbum),

  // Admin routes — all require auth
  'GET /admin/players':          requireAuth(adminHandlers.getPlayers),
  'POST /admin/players':         requireAuth(adminHandlers.addPlayer),
  'PUT /admin/players':          requireAuth(adminHandlers.updatePlayer),
  'DELETE /admin/players':       requireAuth(adminHandlers.deletePlayer),
  'GET /admin/groups':           requireAuth(adminHandlers.getGroups),
  'POST /admin/groups':          requireAuth(adminHandlers.addGroup),
  'PUT /admin/groups':           requireAuth(adminHandlers.updateGroup),
  'DELETE /admin/groups':        requireAuth(adminHandlers.deleteGroup),
  'GET /admin/family-tree':      requireAuth(adminHandlers.getFamilyTree),
  'PUT /admin/family-tree':      requireAuth(adminHandlers.updateFamilyTree),
  'GET /admin/seasons':          requireAuth(adminHandlers.getSeasons),
  'POST /admin/seasons':         requireAuth(adminHandlers.addSeason),
  'PUT /admin/seasons':          requireAuth(adminHandlers.updateSeason),
  'DELETE /admin/seasons':       requireAuth(adminHandlers.deleteSeason),
  'GET /admin/user-facts':       requireAuth(adminHandlers.getUserFacts),
  'PUT /admin/user-facts':       requireAuth(adminHandlers.updateUserFact),
  'DELETE /admin/user-facts':    requireAuth(adminHandlers.deleteUserFact),
  'GET /admin/user-trivia':      requireAuth(adminHandlers.getUserTrivia),
  'DELETE /admin/user-trivia':   requireAuth(adminHandlers.deleteUserTrivia),
  'GET /admin/game-sessions':    requireAuth(adminHandlers.getGameSessions),
  'DELETE /admin/game-sessions': requireAuth(adminHandlers.resetGameSession),
  'GET /admin/daily-questions':   requireAuth(adminHandlers.getDailyQuestions),
  'DELETE /admin/daily-questions': requireAuth(adminHandlers.deleteDailyQuestion),
  'GET /admin/trivia-bank/stats':    requireAuth(triviaBankStats),
  'GET /admin/trivia-bank/browse':   requireAuth(triviaBankBrowse),
  'DELETE /admin/trivia-bank/question': requireAuth(triviaBankDelete),
  'POST /admin/trivia-bank/import':  requireAuth(triviaBankImport),
  'GET /admin/family-feud':      requireAuth(adminGetFamilyFeud),
  'DELETE /admin/family-feud':   requireAuth(adminResetFamilyFeud),
  'GET /admin/system-info':     requireAuth(getSystemInfo),
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
    .replace(/^\/prod\/?/, '/')   // REST API stage prefix (legacy, safe no-op for HTTP API)
    .replace(/^\/api\/?/, '/')    // CloudFront /api/* behavior prefix
    .replace(/\/\/+/g, '/');
  if (path === '/') path = '';

  const key = `${event.httpMethod.toUpperCase()} ${path}`;
  logger.info('Received API request', { route: key });
  
  const fn  = routes[key];
  if (!fn) {
    logger.warn('Route not found', { route: key });
    return jsonResponse({ error: 'Route not found' }, 404);
  }

  try {
    return await fn(event);
  } catch (err: any) {
    logger.error('Unhandled error in route', { 
      route: key, 
      error: err.message,
      stack: err.stack 
    });
    return jsonResponse(
      {
        error: 'Internal server error',
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      },
      500
    );
  }
};
