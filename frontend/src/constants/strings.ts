/**
 * Application string constants
 *
 * This file centralizes all user-facing text strings used throughout the application.
 * Benefits:
 * - Single source of truth for text content
 * - Easier maintenance and updates
 * - Foundation for future internationalization (i18n)
 * - Consistent handling of special characters (apostrophes, etc.)
 */

const strings = {
  // General
  appName: 'Family Trivia',

  // Authentication
  enterPassphrase: 'Enter the family passphrase to continue',
  incorrectPassphrase: 'Incorrect passphrase. Please try again.',

  // Trivia Card
  chooseCategory: 'Choose a Category',
  createCustomCategory: 'Create Custom Category',
  createNewCategory: 'Create New Category',
  customTriviaCategory: 'Custom Trivia Category',
  yourCustomCategory: 'Your Custom Category',

  // Question Status
  dailyLimitReached: "You have already answered today's question!",
  dailyQuestionComplete: "You've completed today's question!",
  answerTodaysQuestion: "Answer Today's Question",
  todaysQuestionReady: "Today's question ready!",
  comeBackAfterMidnight: 'Come back after midnight for a new question.',
  questionsCompleted: "You've completed today's question!",
  questionTimingAfterMidnight: 'Available after midnight',
  questionAvailableNow: 'Available Now',
  triviaStatus: 'Trivia Status',
  lastQuestion: 'Last Question:',
  nextQuestionAvailable: 'Next question available:',
  questionReady: 'Question ready!',

  // Custom Category Form
  createYourCustomCategory: 'Create Your Custom Category',
  passionateAbout:
    "Enter a topic you're passionate about, and we'll create a custom trivia category just for you. You can use this category once per week.",
  generateCategory: 'Generate Category',
  hereIsYourCategory:
    "Here's your custom category! You can use it or try again with a different topic.",
  tryDifferentTopic: 'Try Different Topic',
  useThisCategory: 'Use This Category',
  customCategoryCreationSuccess: 'Custom category created successfully!',
  pleaseLoginToCreate: 'Please log in to create a custom category',
  pleaseLoginToSave: 'Please log in to save your custom category',
  failedToGenerate: 'Failed to generate custom category',
  failedToSave: 'Failed to save custom category',
  yourTopic: 'Your topic',
  topicPlaceholder: 'E.g. French cuisine, 90s hip hop, Marvel superheroes...',

  // Daily Fact Prompt
  quickQuestion: 'Quick Question',
  didYouKnow: 'Did You Know?',
  thanksForSharing: 'Thanks for sharing! A new question awaits next week.',
  yourAnswer: 'Your answer',
  skip: 'Skip',
  submit: 'Submit',
  continue: 'Continue',
  todaysSharedQuestion: "This Week's Question",
  gettingToKnowYou: 'Getting to Know You',
  gettingToKnowYouCatchup: 'Getting to Know You (Catch-up)',
  viewYourAnswer: 'View Your Answer',
  viewTodaysSharedQuestion: "View This Week's Shared Question",
  answerThisQuestion: 'Answer This Question',
  nextQuestion: 'Next Question',
  sharedQuestionDesc: "This is this week's shared question for everyone",
  questionNotAnsweredYet: "This question hasn't been answered yet. Be the first to answer!",
  basicQuestionsComplete: 'All Basic Questions Complete!',
  basicQuestionsCompleteMessage:
    "Congratulations! You've completed all the basic questions. Now you can join today’s shared question that everyone will answer!",
  continueToSharedQuestion: "Continue to Today's Shared Question",
  loadingNextQuestion: 'Loading the next question...',

  // Question Screen
  questionDifficulty: {
    easy: 'Easy',
    normal: 'Standard',
    hard: 'Hard',
  },
  resultDialog: {
    correct: 'Correct!',
    incorrect: 'Incorrect!',
    greatJob: '🎯 Great job! You got the right answer.',
    niceTry: "Nice try, but that wasn't right.",
    correctAnswerWas: 'The correct answer was:',
    points: (points: number) => `+${points} points`,
    nextQuestion: 'Next Question',
    done: 'Done',
    close: 'Close',
  },

  // App
  welcomeMessage: (userId: string) => `Welcome, ${userId}!`,
  invalidPassphrase: 'Invalid passphrase.',
  loggedOut: 'You have been logged out',
  loadingFamilyTrivia: 'Loading Family Trivia...',
  caughtUpNotification: "You caught up! Now you can answer today's question.",

  // Profile Section
  customCategoryExists: (title: string) => `Created custom category: ${title}`,
  customCategoryCreated: (date: string) => `Created: ${date}`,
  customCategoryWeeklyLimit:
    'This custom category can be selected once every 3 days when playing trivia.',
  noCustomCategoryYet: {
    self: "You haven't created a custom trivia category yet.",
    other: "This user hasn't created a custom trivia category yet.",
  },

  // Category Locking
  lockedUntil: (date: string) => `Locked until ${date} — you've selected this too often.`,
  lockedGeneric: 'Locked',

  // Error Messages
  errorSubmittingAnswer: 'Error submitting answer.',
  failedToLoadQuestion: (error: string) => `Failed to load question: ${error || 'Unknown error'}`,
  categoryUndefined: 'Category is undefined or empty',
  couldNotLoadMembers: "Couldn't load members after multiple attempts.",
  couldNotConnectToTrivia: "Couldn't connect to trivia service.",
  couldNotLoadQuestionStatus: 'Could not load question status',
  membersLoadError: 'Could not load members',

  // Actions
  tryAgain: 'Try Again',
  refresh: 'Refresh',
};

export default strings;
