// Module: init
// Consolidated app initialization API — split into critical + deferred.

import { apiService } from '../../services/ApiService';
import { cacheService } from '../../services/CacheService';

import type { FamilyFeudResults } from './familyFeud';
import type {
  UserConfigResponse,
  FamilyHierarchy,
  EndOfSeasonStatus,
  FamilySideConfig,
  MemberStatus,
  PaginationInfo,
  CatchupStatus,
  SystemCategory,
  CustomCategory,
  TimelineFactEntry,
  TimelineTriviaEntry,
} from '@family-trivia/shared';

export interface GroupDescriptionData {
  description: string;
  lastUpdated: string;
  updatedBy?: string;
}

export interface InitQuestionAvailability {
  canAnswer: boolean;
  nextQuestionAt: string | null;
  todayET: string;
  lastQuestionAt: string | null;
  isEndOfSeason?: boolean;
}

export interface GameModeStatus {
  canPlay: boolean;
  hasActiveSession: boolean;
  nextAvailable: string | null;
}

export interface FamilyFeudInitData {
  currentRound: {
    roundId: string;
    targetUserId: string;
    targetUserName: string;
    question: string;
    status: string;
    startedAt: string;
    expiresAt: string;
    guessCount: number;
    myGuess: string | null;
    choices: string[] | null;
    realAnswer: string | null;
    results: FamilyFeudResults | null;
  } | null;
  isMyTurn: boolean;
  nextTargetUserId: string;
  nextTargetUserName: string;
  timesAsTarget: number;
}

// Critical init response — returned fast, blocks first paint
export interface AppInitResponse {
  isFirstRun?: boolean;
  userConfig: UserConfigResponse | null;
  hierarchy: {
    hierarchy: FamilyHierarchy;
    groupDescriptions: Record<string, string>;
    familySides: Record<string, FamilySideConfig>;
    success: boolean;
  } | null;
  seasonStatus: EndOfSeasonStatus;
  memberActivation: Record<string, MemberStatus[]>;
  groupDescriptions: Record<string, GroupDescriptionData>;
  questionAvailability?: InitQuestionAvailability;
  categories?: SystemCategory[];
  userCategories?: CustomCategory[];
}

// Deferred init response — loaded in background after first paint
export interface AppInitDeferredResponse {
  timelineData?: { facts: TimelineFactEntry[]; trivia: TimelineTriviaEntry[] };
  timelinePagination?: PaginationInfo;
  familySides?: Record<string, FamilySideConfig>;
  catchupStatus?: CatchupStatus;
  gameStatuses?: {
    casinoRush: GameModeStatus;
    slotMachine: GameModeStatus;
    curling?: { canPlay: boolean; nextAvailable: string | null };
  };
  familyFeud?: FamilyFeudInitData;
}

export function clearApiCache() {
  cacheService.clearAll();
}

export async function getAppInit(userId?: string): Promise<AppInitResponse> {
  const params = new URLSearchParams();
  if (userId) params.append('userId', userId);

  const query = params.toString();
  const url = `/app-init${query ? `?${query}` : ''}`;

  return apiService.request<AppInitResponse>(url, {
    method: 'GET',
    headers: { 'Cache-Control': 'no-cache' },
  },
  undefined,
  true,
  15000, // Faster timeout — critical path is lighter now
  );
}

export async function getAppInitDeferred(userId: string, side = 'all'): Promise<AppInitDeferredResponse> {
  const params = new URLSearchParams({ userId });
  if (side !== 'all') params.append('side', side);

  return apiService.request<AppInitDeferredResponse>(`/app-init-deferred?${params}`, {
    method: 'GET',
    headers: { 'Cache-Control': 'no-cache' },
  },
  undefined,
  true,
  30000,
  );
}
