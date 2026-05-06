// File: lambda/constants.ts

// User groups are now stored in S3 config/users.json
// Group descriptions are stored in S3 config/group_descriptions.json

// S3 Path constants
export const S3_PATHS = {
  // User Profiles & Configuration
  USER_PROFILE: (userId: string) => `profile_data/${userId}.json`,
  USERS_CONFIG: 'config/users.json',

  // Family Structure
  FAMILY_HIERARCHY: 'family/hierarchy.json',

  // Trivia & Answers
  ANSWER_HISTORY: (userId: string) => `answers/history/${userId}.json`,
  CATEGORIES: 'categories/categories.json',
  USER_CATEGORIES: (userId: string) => `categories/${userId}/categories.json`,

  // Facts & Daily Questions
  DAILY_FACTS_DIR: (userId: string) => `facts/daily/${userId}/`,
  BASIC_QUESTION: (userId: string, index: number, date: string) => `facts/daily/${userId}/basic_${index}_${date}.json`,
  SHARED_QUESTION: (userId: string, date: string) => `facts/daily/${userId}/shared_${date}.json`,
  GLOBAL_SHARED_QUESTION: (date: string) => `facts/daily/shared/${date}.json`,
  SHARED_QUESTIONS_DIR: 'facts/daily/shared/',
  BASIC_QUESTIONS_CONFIG: 'config/basic_questions.json',
  FACT_ANSWER_HISTORY: (userId: string) => `facts/answers/${userId}.json`,

  // User Summaries
  USER_SUMMARY: (userId: string) => `summaries/${userId}/summary.json`,

  // Group Descriptions
  GROUP_DESCRIPTIONS: 'config/group_descriptions.json',

  // Seasons
  SEASONS_CONFIG: 'config/seasons.json',

  // Casino Rush
  CASINO_RUSH_CURRENT_SESSION: (userId: string) => `casino-rush/${userId}/current-session.json`,
  CASINO_RUSH_SESSION: (userId: string, sessionId: string) => `casino-rush/${userId}/sessions/${sessionId}.json`,
  CASINO_RUSH_SESSIONS_DIR: (userId: string) => `casino-rush/${userId}/sessions/`,
  CASINO_RUSH_HISTORY: (userId: string) => `casino-rush/${userId}/history.json`,

  // Slot Machine
  SLOT_MACHINE_SESSION: (userId: string) => `slot-machine/${userId}/session.json`,

  // Tetris
  TETRIS_SESSION: (userId: string) => `tetris/${userId}/session.json`,
  TETRIS_HIGH_SCORES: 'tetris/high-scores.json',

  // Arcade (unified high scores for all games)
  ARCADE_SCORES: (gameId: string) => `arcade/scores/${gameId}.json`,

  // Celebrations
  CELEBRATIONS: 'celebrations/celebrations.json',

  // Photo Albums (links to external Google Photos shared albums, etc.)
  PHOTO_ALBUMS: 'photos/albums.json',

  // Casino (shared credit pool across slots + blackjack)
  CASINO_BALANCE: (userId: string) => `casino/balances/${userId}.json`,

  // Category Accuracy (cached stats for bonus calculation)
  CATEGORY_ACCURACY_CACHE: 'config/category-accuracy.json',

  // Member activation cache (avoids N+1 reads in appInit)
  MEMBER_ACTIVATION: 'config/member-activation.json',
};