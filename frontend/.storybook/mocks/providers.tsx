import React, { createContext, useContext } from 'react';

// ---------------------------------------------------------------------------
// 1. FamilyDataContext mock
// ---------------------------------------------------------------------------

interface FamilyMember {
  userId: string;
  activated: boolean;
  name: string;
  group: string;
  color: string;
}

interface GroupDescription {
  description: string;
  lastUpdated: string;
}

interface FamilyDataContextType {
  members: FamilyMember[];
  loadingMembers: boolean;
  hierarchyData: unknown;
  groupDescriptions: Record<string, GroupDescription>;
  loadError: string | null;
  seasonStatus: unknown;
  loadingSeasonStatus: boolean;
  appInitComplete: boolean;
  refreshMembers: (forceRefresh?: boolean) => Promise<void>;
  refreshHierarchy: () => Promise<void>;
  refreshGroupDescriptions: () => Promise<void>;
  updateMemberActivation: (userId: string, activated: boolean) => void;
  clearError: () => void;
}

const FamilyDataContext = createContext<FamilyDataContextType | undefined>(undefined);

const mockMembers: FamilyMember[] = [
  { userId: 'rob', activated: true, name: 'Rob', group: 'group-a', color: '#2e7d32' },
  { userId: 'alice', activated: true, name: 'Alice', group: 'group-a', color: '#1976d2' },
  { userId: 'bob', activated: true, name: 'Bob', group: 'group-b', color: '#ff9800' },
  { userId: 'carol', activated: false, name: 'Carol', group: 'group-b', color: '#9c27b0' },
];

const defaultFamilyData: FamilyDataContextType = {
  members: mockMembers,
  loadingMembers: false,
  hierarchyData: null,
  groupDescriptions: {},
  loadError: null,
  seasonStatus: null,
  loadingSeasonStatus: false,
  appInitComplete: true,
  refreshMembers: async () => {},
  refreshHierarchy: async () => {},
  refreshGroupDescriptions: async () => {},
  updateMemberActivation: () => {},
  clearError: () => {},
};

export const MockFamilyDataProvider: React.FC<{
  children: React.ReactNode;
  overrides?: Partial<FamilyDataContextType>;
}> = ({ children, overrides }) => (
  <FamilyDataContext.Provider value={{ ...defaultFamilyData, ...overrides }}>
    {children}
  </FamilyDataContext.Provider>
);

export const useMockFamilyData = (): FamilyDataContextType => {
  const ctx = useContext(FamilyDataContext);
  if (!ctx) throw new Error('useMockFamilyData must be used within MockFamilyDataProvider');
  return ctx;
};

// ---------------------------------------------------------------------------
// 2. TimelineContext mock
// ---------------------------------------------------------------------------

interface TimelineContextType {
  timelineData: { facts: unknown[]; trivia: unknown[]; familySides: Record<string, unknown> };
  selectedSide: string;
  lastRefreshed: number;
  factCommentThreads: unknown[];
  triviaCommentThreads: unknown[];
  commentsLoading: boolean;
  commentsLastRefreshed: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  initialLoadDone: boolean;
  hasMoreFacts: boolean;
  hasMoreTrivia: boolean;
  setSelectedSide: (side: string) => void;
  refreshTimeline: (forceRefresh?: boolean) => Promise<boolean>;
  loadMoreTimeline: () => Promise<void>;
  getCommentsForFact: (factId: string) => unknown[];
  getCommentsForTrivia: (triviaId: string) => unknown[];
  addComment: (
    userId: string,
    contentId: string,
    text: string,
    parentId?: string,
    contentType?: 'fact' | 'trivia',
  ) => Promise<unknown>;
  refreshComments: () => Promise<void>;
}

const TimelineContext = createContext<TimelineContextType | null>(null);

const defaultTimeline: TimelineContextType = {
  timelineData: { facts: [], trivia: [], familySides: {} },
  selectedSide: 'all',
  lastRefreshed: Date.now(),
  factCommentThreads: [],
  triviaCommentThreads: [],
  commentsLoading: false,
  commentsLastRefreshed: Date.now(),
  loading: false,
  loadingMore: false,
  error: null,
  initialLoadDone: true,
  hasMoreFacts: false,
  hasMoreTrivia: false,
  setSelectedSide: () => {},
  refreshTimeline: async () => true,
  loadMoreTimeline: async () => {},
  getCommentsForFact: () => [],
  getCommentsForTrivia: () => [],
  addComment: async () => ({}),
  refreshComments: async () => {},
};

export const MockTimelineProvider: React.FC<{
  children: React.ReactNode;
  overrides?: Partial<TimelineContextType>;
}> = ({ children, overrides }) => (
  <TimelineContext.Provider value={{ ...defaultTimeline, ...overrides }}>
    {children}
  </TimelineContext.Provider>
);

export const useMockTimeline = (): TimelineContextType => {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error('useMockTimeline must be used within MockTimelineProvider');
  return ctx;
};

// ---------------------------------------------------------------------------
// 3. UserStatusContext mock
// ---------------------------------------------------------------------------

interface UserStatusContextType {
  catchupStatus: {
    questionsBehind: number;
    userAnswerCount: number;
    maxQuestionsAvailable: number;
  } | null;
  loadingCatchup: boolean;
  hasAnsweredToday: boolean;
  canAnswerQuestion: boolean;
  todayET: string;
  todayResult: {
    correct: boolean;
    streak: number;
    pointsEarned?: number;
  } | null;
  lastQuestion: unknown;
  lastAnswer: string | null;
  refreshUserStatus: () => Promise<void>;
  clearTodayResult: () => void;
  updateCatchupStatus: (status: {
    questionsBehind: number;
    userAnswerCount: number;
    maxQuestionsAvailable: number;
  }) => void;
  setAnswerResult: (
    result: { correct: boolean; streak: number; pointsEarned?: number },
    question?: unknown,
    selected?: string,
  ) => void;
  shouldShowQuestionStatus: () => boolean;
}

const UserStatusContext = createContext<UserStatusContextType | undefined>(undefined);

const defaultUserStatus: UserStatusContextType = {
  catchupStatus: null,
  loadingCatchup: false,
  hasAnsweredToday: false,
  canAnswerQuestion: true,
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

export const MockUserStatusProvider: React.FC<{
  children: React.ReactNode;
  overrides?: Partial<UserStatusContextType>;
}> = ({ children, overrides }) => (
  <UserStatusContext.Provider value={{ ...defaultUserStatus, ...overrides }}>
    {children}
  </UserStatusContext.Provider>
);

export const useMockUserStatus = (): UserStatusContextType => {
  const ctx = useContext(UserStatusContext);
  if (!ctx) throw new Error('useMockUserStatus must be used within MockUserStatusProvider');
  return ctx;
};

// ---------------------------------------------------------------------------
// 4. TriviaStatusContext mock (includes CategoryRefresh)
// ---------------------------------------------------------------------------

interface TriviaStatusContextType {
  slotMachine: {
    canPlay: boolean;
    nextAvailable: Date | null;
    hasActiveSession: boolean;
    loading: boolean;
    lastUpdated: number;
  };
  casinoRush: {
    canPlay: boolean;
    nextAvailable: Date | null;
    hasActiveSession: boolean;
    loading: boolean;
    lastUpdated: number;
  };
  refreshSlotMachineStatus: (userId: string) => Promise<void>;
  refreshCasinoRushStatus: (userId: string) => Promise<void>;
  refreshAllStatuses: (userId: string) => Promise<void>;
  refreshCategories: () => void;
}

const TriviaStatusContext = createContext<TriviaStatusContextType | undefined>(undefined);

const defaultTriviaStatus: TriviaStatusContextType = {
  slotMachine: {
    canPlay: true,
    nextAvailable: null,
    hasActiveSession: false,
    loading: false,
    lastUpdated: Date.now(),
  },
  casinoRush: {
    canPlay: true,
    nextAvailable: null,
    hasActiveSession: false,
    loading: false,
    lastUpdated: Date.now(),
  },
  refreshSlotMachineStatus: async () => {},
  refreshCasinoRushStatus: async () => {},
  refreshAllStatuses: async () => {},
  refreshCategories: () => {},
};

export const MockTriviaStatusProvider: React.FC<{
  children: React.ReactNode;
  overrides?: Partial<TriviaStatusContextType>;
}> = ({ children, overrides }) => (
  <TriviaStatusContext.Provider value={{ ...defaultTriviaStatus, ...overrides }}>
    {children}
  </TriviaStatusContext.Provider>
);

export const useMockTriviaStatus = (): TriviaStatusContextType => {
  const ctx = useContext(TriviaStatusContext);
  if (!ctx) throw new Error('useMockTriviaStatus must be used within MockTriviaStatusProvider');
  return ctx;
};

// ---------------------------------------------------------------------------
// 5. CategoryRefreshContext mock (needed by TriviaStatusProvider)
// ---------------------------------------------------------------------------

interface CategoryRefreshContextType {
  refreshTimestamp: number;
  invalidateCategories: () => void;
}

const CategoryRefreshContext = createContext<CategoryRefreshContextType | undefined>(undefined);

const defaultCategoryRefresh: CategoryRefreshContextType = {
  refreshTimestamp: 0,
  invalidateCategories: () => {},
};

export const MockCategoryRefreshProvider: React.FC<{
  children: React.ReactNode;
  overrides?: Partial<CategoryRefreshContextType>;
}> = ({ children, overrides }) => (
  <CategoryRefreshContext.Provider value={{ ...defaultCategoryRefresh, ...overrides }}>
    {children}
  </CategoryRefreshContext.Provider>
);

// ---------------------------------------------------------------------------
// Combined MockAppProviders
// ---------------------------------------------------------------------------
// Nesting order: TriviaStatus > FamilyData > Timeline > UserStatus
// This mirrors the real app provider nesting.

export const MockAppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MockCategoryRefreshProvider>
    <MockTriviaStatusProvider>
      <MockFamilyDataProvider>
        <MockTimelineProvider>
          <MockUserStatusProvider>{children}</MockUserStatusProvider>
        </MockTimelineProvider>
      </MockFamilyDataProvider>
    </MockTriviaStatusProvider>
  </MockCategoryRefreshProvider>
);
