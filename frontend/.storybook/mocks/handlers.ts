// File: .storybook/mocks/handlers.ts
// MSW request handlers for Storybook — mock the step pipeline + common endpoints.

import { http, HttpResponse, delay } from 'msw';

import type {
  Step1Response,
  Step2Response,
  Step3Response,
  Question,
} from '@family-trivia/shared';

// ── Mock Data ─────────────────────────────────────────────────────

const mockQuestion: Question = {
  question: 'What company introduced the first commercially successful portable camera in 1888?',
  choices: ['Kodak', 'Polaroid', 'Canon', 'Leica'],
  answer: 'Kodak',
  category: 'History',
  difficulty: 'normal',
  pointMultiplier: 1,
};

// ── Default Handlers ──────────────────────────────────────────────

export const stepPipelineHandlers = [
  // Step 1: Generate question
  http.post('*/question-gen/step1', async () => {
    await delay(2000);
    const response: Step1Response = {
      question: mockQuestion,
      sessionId: `mock_${Date.now()}_abc123`,
      generatedAt: Date.now(),
      source: 'sonnet',
      bedrockCalls: 2,
    };
    return HttpResponse.json({ ok: true, data: response });
  }),

  // Step 2: Duplicate check — passes by default
  http.post('*/question-gen/step2', async () => {
    await delay(800);
    const response: Step2Response = {
      isDuplicate: false,
      sessionId: `mock_${Date.now()}_abc123`,
      checkedAt: Date.now(),
      question: mockQuestion,
    };
    return HttpResponse.json({ ok: true, data: response });
  }),

  // Step 3: Fact check — passes by default
  http.post('*/question-gen/step3', async () => {
    await delay(1200);
    const response: Step3Response = {
      question: mockQuestion,
      factCheckResult: { isAccurate: true, confidence: 1, checkedBy: 'Claude Haiku', explanation: 'Verified' },
      sessionId: `mock_${Date.now()}_abc123`,
      completedAt: Date.now(),
      ready: true,
    };
    return HttpResponse.json({ ok: true, data: response });
  }),
];

/** Handlers where step 2 detects a duplicate (triggers retry) */
export const duplicateDetectedHandlers = [
  http.post('*/question-gen/step1', async () => {
    await delay(1500);
    return HttpResponse.json({
      ok: true,
      data: {
        question: mockQuestion,
        sessionId: `mock_${Date.now()}_retry`,
        generatedAt: Date.now(),
        source: 'haiku',
        bedrockCalls: 2,
      } satisfies Step1Response,
    });
  }),

  http.post('*/question-gen/step2', async () => {
    await delay(600);
    return HttpResponse.json({
      ok: true,
      data: {
        isDuplicate: true,
        matchMethod: 'topic_overlap',
        matchedTopics: ['kodak', 'camera'],
        similarQuestions: [{ question: 'Which company made the first portable camera?', similarity: 0.85, matchMethod: 'topic_overlap' }],
        sessionId: `mock_${Date.now()}_retry`,
        checkedAt: Date.now(),
        question: mockQuestion,
      } satisfies Step2Response,
    });
  }),
];

/** Handlers where step 3 fact-check fails */
export const factCheckFailHandlers = [
  ...stepPipelineHandlers.slice(0, 2), // step1 + step2 pass
  http.post('*/question-gen/step3', async () => {
    await delay(1000);
    return HttpResponse.json({
      ok: true,
      data: {
        question: mockQuestion,
        factCheckResult: { isAccurate: false, confidence: 0.4, checkedBy: 'Claude Haiku', explanation: 'Answer may be incorrect' },
        sessionId: `mock_${Date.now()}_fail`,
        completedAt: Date.now(),
        ready: false,
      } satisfies Step3Response,
    });
  }),
];

// ── Common endpoint mocks (needed by TriviaFlow) ─────────────────

export const commonHandlers = [
  // config.json — ApiService calls loadConfig() on the first request and
  // caches the result. We force `/api` here so per-story handlers registered
  // at `/api/...` actually match the fetch path. Without this, ApiService
  // would use `public/config.json` (which points at localhost:3001),
  // every literal `/api/...` story handler would miss, fetches would fall
  // through, and components would render their empty/error fallback state.
  http.get('*/config.json', () =>
    HttpResponse.json({ REACT_APP_API_URL: '/api' }),
  ),

  // User profile
  http.get('*/user-profile', () =>
    HttpResponse.json({
      ok: true,
      data: {
        userId: 'alice',
        history: [],
        categorySelections: [],
        factHistory: [],
      },
    }),
  ),

  // Categories
  http.get('*/categories', () =>
    HttpResponse.json({
      ok: true,
      data: {
        system: [
          { name: 'History', description: 'Historical events' },
          { name: 'Science', description: 'Scientific discoveries' },
          { name: 'Geography', description: 'World geography' },
          { name: 'Entertainment', description: 'Movies, music, TV' },
        ],
        custom: [],
      },
    }),
  ),

  // Catchup status
  http.get('*/catchup-status', () =>
    HttpResponse.json({ ok: true, data: { questionsBehind: 0, userAnswerCount: 5, maxQuestionsAvailable: 5 } }),
  ),

  // Can answer
  http.get('*/can-answer-question', () =>
    HttpResponse.json({ ok: true, data: { canAnswer: true, nextQuestionAt: '', todayET: new Date().toISOString().slice(0, 10) } }),
  ),

  // Submit answer
  http.post('*/submit-answer', async () => {
    await delay(300);
    return HttpResponse.json({ ok: true, data: { correct: true, streak: 1, pointsEarned: 1 } });
  }),

  // App init
  http.get('*/app-init', () =>
    HttpResponse.json({ ok: true, data: { catchupStatus: { questionsBehind: 0 }, seasonStatus: null } }),
  ),
];

// ── Notification mock handlers ────────────────────────────────────

import type { NotificationSummary, NotificationItem as NItem } from '@family-trivia/shared';

const mockCommentNotifications: NItem[] = [
  {
    id: 'comment-trivia-abc123',
    type: 'comment',
    timestamp: new Date(Date.now() - 300_000).toISOString(),
    read: false,
    contentType: 'trivia',
    contentId: 'abc123',
    commentUserId: 'bob',
    commentText: 'Great question! I had no idea about this.',
    threadCommentCount: 2,
  },
  {
    id: 'comment-fact-alice_2026-04-05',
    type: 'comment',
    timestamp: new Date(Date.now() - 1_800_000).toISOString(),
    read: false,
    contentType: 'fact',
    contentId: 'alice_2026-04-05',
    commentUserId: 'carol',
    commentText: 'That is so cool!',
    threadCommentCount: 1,
  },
  {
    id: 'comment-trivia-def456',
    type: 'comment',
    timestamp: new Date(Date.now() - 7_200_000).toISOString(),
    read: true,
    contentType: 'trivia',
    contentId: 'def456',
    commentUserId: 'rob',
    commentText: 'I got this one wrong too',
    threadCommentCount: 1,
  },
];

const mockLeaderNotification: NItem = {
  id: 'leader-individual-1712345678',
  type: 'leader_change',
  timestamp: new Date(Date.now() - 600_000).toISOString(),
  read: false,
  leaderType: 'individual',
  newLeaderId: 'alice',
  previousLeaderId: 'bob',
};

export const notificationHandlers = [
  http.get('*/notifications', () => {
    const items = [...mockCommentNotifications];
    const summary: NotificationSummary = {
      unreadCount: items.filter(i => !i.read).length,
      items,
    };
    return HttpResponse.json({ ok: true, data: summary });
  }),

  http.post('*/notifications/mark-read', () =>
    HttpResponse.json({ ok: true, data: { success: true } }),
  ),

  http.post('*/notifications/mark-all-read', () =>
    HttpResponse.json({ ok: true, data: { success: true } }),
  ),
];

export const notificationWithLeaderHandlers = [
  http.get('*/notifications', () => {
    const items = [mockLeaderNotification, ...mockCommentNotifications];
    const summary: NotificationSummary = {
      unreadCount: items.filter(i => !i.read).length,
      items,
    };
    return HttpResponse.json({ ok: true, data: summary });
  }),
  ...notificationHandlers.slice(1),
];

export const emptyNotificationHandlers = [
  http.get('*/notifications', () =>
    HttpResponse.json({ ok: true, data: { unreadCount: 0, items: [] } }),
  ),
  ...notificationHandlers.slice(1),
];

/** All handlers combined — use for most stories */
export const allHandlers = [...commonHandlers, ...stepPipelineHandlers, ...notificationHandlers];
