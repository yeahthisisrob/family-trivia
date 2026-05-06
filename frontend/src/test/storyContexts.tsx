// Minimal context stubs for Storybook stories. Real providers hit the
// network; these return plausible empty data so components render.

import React from 'react';

import { AdminContext } from '../contexts/AdminContext';
import { FamilyDataContext } from '../contexts/FamilyDataContext';
import { LeaderboardContext } from '../contexts/LeaderboardContext';
import { TimelineContext } from '../contexts/TimelineContext';
import { TriviaContext } from '../contexts/TriviaContext';
import { UserStatusContext } from '../contexts/UserStatusContext';

// ── TimelineContext ────────────────────────────────────────────────

export interface StubTimelineOverrides {
  /** Seed comments for trivia threads, keyed by contentId */
  triviaComments?: Record<string, Array<{
    commentId: string;
    userId: string;
    text: string;
    timestamp: string;
    parentId?: string | null;
  }>>;
  /** Seed comments for fact threads, keyed by contentId */
  factComments?: Record<string, Array<{
    commentId: string;
    userId: string;
    text: string;
    timestamp: string;
    parentId?: string | null;
  }>>;
  commentsLoading?: boolean;
  onAddComment?: (userId: string, contentId: string, text: string) => void;
}

function makeTimelineValue(overrides: StubTimelineOverrides = {}) {
  const triviaComments = overrides.triviaComments ?? {};
  const factComments = overrides.factComments ?? {};

  // Build a counts map from seed data
  const countsMap = new Map<string, number>();
  for (const [id, arr] of Object.entries(factComments)) {
    if (arr.length > 0) countsMap.set(`fact:${id}`, arr.length);
  }
  for (const [id, arr] of Object.entries(triviaComments)) {
    if (arr.length > 0) countsMap.set(`trivia:${id}`, arr.length);
  }

  return {
    timelineData: { facts: [], trivia: [], familySides: {} },
    selectedSide: 'all' as const,
    lastRefreshed: 0,
    commentCounts: countsMap,
    commentsLoading: overrides.commentsLoading ?? false,
    commentsLastRefreshed: 0,
    loading: false,
    loadingMore: false,
    error: null,
    initialLoadDone: true,
    hasMoreFacts: false,
    hasMoreTrivia: false,
    setSelectedSide: () => {},
    refreshTimeline: async () => true,
    loadMoreTimeline: async () => {},
    // Unified comment access
    getComments: (contentType: string, id: string) =>
      (contentType === 'fact' ? factComments[id] : triviaComments[id]) ?? [],
    fetchComments: async (contentType: string, id: string) => ({
      contentType,
      contentId: id,
      comments: (contentType === 'fact' ? factComments[id] : triviaComments[id]) ?? [],
      lastUpdated: new Date().toISOString(),
    }),
    addComment: async (contentType: string, contentId: string, userId: string, text: string) => {
      overrides.onAddComment?.(userId, contentId, text);
      return {} as any;
    },
    refreshCommentCounts: async () => {},
    // Deprecated compat shims
    getCommentsForFact: (id: string) => factComments[id] ?? [],
    getCommentsForTrivia: (id: string) => triviaComments[id] ?? [],
    fetchTriviaCommentsForId: async (id: string) => ({
      contentType: 'trivia' as const,
      contentId: id,
      comments: triviaComments[id] ?? [],
      lastUpdated: new Date().toISOString(),
    }),
    refreshComments: async () => {},
  };
}

// ── TriviaContext ──────────────────────────────────────────────────

export interface StubTriviaOverrides {
  canPlayCasinoRush?: boolean;
  canPlaySlotMachine?: boolean;
  canPlayCurling?: boolean;
  canPlayTetris?: boolean;
}

function makeTriviaValue(overrides: StubTriviaOverrides = {}) {
  return {
    slotMachine: {
      canPlay: overrides.canPlaySlotMachine ?? true,
      nextAvailable: null,
      hasActiveSession: false,
      loading: false,
      lastUpdated: 0,
    },
    casinoRush: {
      canPlay: overrides.canPlayCasinoRush ?? true,
      nextAvailable: null,
      hasActiveSession: false,
      loading: false,
      lastUpdated: 0,
    },
    curling: {
      canPlay: overrides.canPlayCurling ?? true,
      nextAvailable: null,
      loading: false,
      lastUpdated: 0,
    },
    tetris: {
      canPlay: overrides.canPlayTetris ?? true,
      nextAvailable: null,
      loading: false,
      lastUpdated: 0,
    },
    refreshSlotMachineStatus: async () => {},
    refreshCasinoRushStatus: async () => {},
    refreshCurlingStatus: async () => {},
    refreshTetrisStatus: async () => {},
    refreshAllStatuses: async () => {},
    refreshTimestamp: 0,
    invalidateCategories: () => {},
  };
}

// ── FamilyDataContext ──────────────────────────────────────────────

export interface StubFamilyOverrides {
  categories?: Array<{ name: string; description?: string }>;
  appInitComplete?: boolean;
}

function makeFamilyValue(overrides: StubFamilyOverrides = {}) {
  const defaultCategories = [
    { name: 'History & Politics', description: 'Past events and leaders' },
    { name: 'Science & Nature', description: 'How the world works' },
    { name: 'Geography & Travel', description: 'Places and cultures' },
    { name: 'Pop Culture', description: 'Movies, music, shows' },
    { name: 'Sports & Games', description: 'Athletics and play' },
    { name: 'Literature & Arts', description: 'Books and creators' },
  ];
  return {
    members: [],
    loadingMembers: false,
    hierarchyData: null,
    groupDescriptions: {},
    loadError: null,
    seasonStatus: null,
    loadingSeasonStatus: false,
    appInitComplete: overrides.appInitComplete ?? true,
    initTimelineData: null,
    initCatchupStatus: null,
    initQuestionAvailability: null,
    initCategories: overrides.categories ?? defaultCategories,
    initUserCategories: null,
    initGameStatuses: null,
    initFamilyFeud: null,
    refreshMembers: async () => {},
    refreshHierarchy: async () => {},
    refreshGroupDescriptions: async () => {},
    updateMemberActivation: () => {},
    clearError: () => {},
  };
}

// ── UserStatusContext ──────────────────────────────────────────────

export interface StubUserStatusOverrides {
  hasAnsweredToday?: boolean;
  canAnswerQuestion?: boolean;
  questionsBehind?: number;
  loadingCatchup?: boolean;
}

function makeUserStatusValue(overrides: StubUserStatusOverrides = {}) {
  const behind = overrides.questionsBehind ?? 0;
  return {
    catchupStatus: {
      questionsBehind: behind,
      userAnswerCount: 0,
      maxQuestionsAvailable: behind,
    },
    loadingCatchup: overrides.loadingCatchup ?? false,
    hasAnsweredToday: overrides.hasAnsweredToday ?? false,
    canAnswerQuestion: overrides.canAnswerQuestion ?? true,
    todayET: new Date().toISOString().slice(0, 10),
    todayResult: null,
    lastQuestion: null,
    lastAnswer: null,
    refreshUserStatus: async () => {},
    clearTodayResult: () => {},
    updateCatchupStatus: () => {},
    setAnswerResult: () => {},
    shouldShowQuestionStatus: () => true,
  };
}

// ── LeaderboardContext ─────────────────────────────────────────────

const stubLeaderboardValue = {
  players: [],
  groups: [],
  userGroups: {},
  seasons: [],
  selectedSeason: undefined,
  maxQuestionsAsked: undefined,
  globalCategoryStats: {},
  loading: false,
  error: null,
  setSelectedSeason: () => {},
  refreshLeaderboard: () => {},
  clearError: () => {},
};

// ── Combined provider used by stories ──────────────────────────────

export interface StoryProvidersProps {
  children: React.ReactNode;
  trivia?: StubTriviaOverrides;
  family?: StubFamilyOverrides;
  userStatus?: StubUserStatusOverrides;
  timeline?: StubTimelineOverrides;
}

export const StoryProviders: React.FC<StoryProvidersProps> = ({ children, trivia, family, userStatus, timeline }) => (
  <FamilyDataContext.Provider value={makeFamilyValue(family) as any}>
    <LeaderboardContext.Provider value={stubLeaderboardValue as any}>
      <TriviaContext.Provider value={makeTriviaValue(trivia) as any}>
        <UserStatusContext.Provider value={makeUserStatusValue(userStatus) as any}>
          <TimelineContext.Provider value={makeTimelineValue(timeline) as any}>
            {children}
          </TimelineContext.Provider>
        </UserStatusContext.Provider>
      </TriviaContext.Provider>
    </LeaderboardContext.Provider>
  </FamilyDataContext.Provider>
);

// ── Admin stub ─────────────────────────────────────────────────────

export interface StubAdminOverrides {
  players?: unknown[];
  groups?: unknown[];
  seasons?: unknown[];
  sides?: Record<string, unknown>;
  loading?: boolean;
  error?: string | null;
}

function makeAdminValue(overrides: StubAdminOverrides = {}) {
  const noop = async () => {};
  return {
    adminUserId: 'admin',
    players: overrides.players ?? [],
    groups: overrides.groups ?? [],
    sides: overrides.sides ?? {},
    seasons: overrides.seasons ?? [],
    currentSeasonNumber: 1,
    rootPartners: [],
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    loadPlayers: noop, loadGroups: noop, loadFamilyTree: noop,
    loadSeasons: noop, loadAll: noop,
    addPlayer: noop, updatePlayer: noop, deletePlayer: noop,
    addGroup: noop, updateGroup: noop, deleteGroup: noop,
    updateFamilyTree: noop,
    addSeason: noop, updateSeason: noop, deleteSeason: noop,
  };
}

export const AdminStoryProviders: React.FC<{
  children: React.ReactNode;
  admin?: StubAdminOverrides;
}> = ({ children, admin }) => (
  <StoryProviders>
    <AdminContext.Provider value={makeAdminValue(admin) as any}>
      {children}
    </AdminContext.Provider>
  </StoryProviders>
);

// Alias kept for backward compat with existing HistoryCard stories
export const StubTimelineProvider = StoryProviders;
