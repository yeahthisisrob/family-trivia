import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

import * as api from '../api';
import { FamilyHierarchy as ApiFamilyHierarchy } from '../api/modules/family';
import { getAppInit, getAppInitDeferred, AppInitResponse } from '../api/modules/init';
import { UserConfigResponse } from '../api/modules/user';
import { cacheService } from '../services/CacheService';
import { colors } from '../shared/design-system/tokens/colors';
import { createLogger } from '../utils/logger';

import type { InitQuestionAvailability, GameModeStatus, FamilyFeudInitData } from '../api/modules/init';
import type {
  EndOfSeasonStatus, PaginationInfo, CatchupStatus,
  TimelineFactEntry, TimelineTriviaEntry, FamilySideConfig,
  SystemCategory, CustomCategory,
} from '@family-trivia/shared';

// Types
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

// Init data passed to other contexts (timeline, catchup)
export interface InitTimelineData {
  facts: TimelineFactEntry[];
  trivia: TimelineTriviaEntry[];
  pagination?: PaginationInfo;
  familySides?: Record<string, FamilySideConfig>;
}

// Context type
interface FamilyDataContextType {
  // Data
  members: FamilyMember[];
  loadingMembers: boolean;
  hierarchyData: ApiFamilyHierarchy | null;
  groupDescriptions: Record<string, GroupDescription>;
  loadError: string | null;
  seasonStatus: EndOfSeasonStatus | null;
  loadingSeasonStatus: boolean;
  appInitComplete: boolean;
  isFirstRun: boolean;

  // Init data for other contexts to consume (loaded in single /app-init call)
  initTimelineData: InitTimelineData | null;
  initCatchupStatus: CatchupStatus | null;
  initQuestionAvailability: InitQuestionAvailability | null;
  initCategories: SystemCategory[] | null;
  initUserCategories: CustomCategory[] | null;
  initGameStatuses: { casinoRush: GameModeStatus; slotMachine: GameModeStatus; curling?: { canPlay: boolean; nextAvailable: string | null }; tetris?: { canPlay: boolean; nextAvailable: string | null } } | null;
  initFamilyFeud: FamilyFeudInitData | null;

  // Methods
  refreshMembers: (forceRefresh?: boolean) => Promise<void>;
  refreshHierarchy: () => Promise<void>;
  refreshGroupDescriptions: () => Promise<void>;
  updateMemberActivation: (userId: string, activated: boolean) => void;
  clearError: () => void;
}

// Initialize logger
const logger = createLogger('FamilyDataContext');

// Default color when user config is unavailable
const DEFAULT_COLOR = colors.defaultUser;

// Create context
export const FamilyDataContext = createContext<FamilyDataContextType | undefined>(undefined);

/**
 * Build FamilyMember[] from hierarchy people and optional user config.
 */
function buildMembers(
  hierarchy: ApiFamilyHierarchy,
  userConfig: UserConfigResponse | null,
): FamilyMember[] {
  const members: FamilyMember[] = [];

  if (!hierarchy.family?.people) return members;

  Object.entries(hierarchy.family.people).forEach(([userId, personData]) => {
    if (personData.groupId) {
      const color = userConfig ? api.getUserColor(userConfig, userId) : DEFAULT_COLOR;
      members.push({
        userId,
        activated: false, // Updated later from activation data
        name: personData.name || userId,
        group: personData.groupId,
        color,
      });
    }
  });

  return members.sort((a, b) => a.userId.localeCompare(b.userId));
}

// Provider component
export const FamilyDataProvider: React.FC<{ children: React.ReactNode; userId?: string | null }> = ({ children, userId: userIdProp }) => {
  // State
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [appInitLoading, setAppInitLoading] = useState(true);
  const [appInitComplete, setAppInitComplete] = useState(false);
  const [isFirstRun, setIsFirstRun] = useState(false);
  const [hierarchyData, setHierarchyData] = useState<ApiFamilyHierarchy | null>(null);
  const [groupDescriptions, setGroupDescriptions] = useState<Record<string, GroupDescription>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [seasonStatus, setSeasonStatus] = useState<EndOfSeasonStatus | null>(null);

  // Init data for other contexts
  const [initTimelineData, setInitTimelineData] = useState<InitTimelineData | null>(null);
  const [initCatchupStatus, setInitCatchupStatus] = useState<CatchupStatus | null>(null);
  const [initQuestionAvailability, setInitInitQuestionAvailability] = useState<InitQuestionAvailability | null>(null);
  const [initCategories, setInitCategories] = useState<SystemCategory[] | null>(null);
  const [initUserCategories, setInitUserCategories] = useState<CustomCategory[] | null>(null);
  const [initGameStatuses, setInitGameStatuses] = useState<{ casinoRush: GameModeStatus; slotMachine: GameModeStatus; curling?: { canPlay: boolean; nextAvailable: string | null } } | null>(null);
  const [initFamilyFeud, setInitFamilyFeud] = useState<FamilyFeudInitData | null>(null);

  // Refs for tracking loading state
  const loadingRef = useRef(false);
  const attemptsRef = useRef(0);

  // Load deferred data (timeline, catchup, games, feud) — fires after critical init
  const loadDeferredData = useCallback(async (userId: string) => {
    try {
      const deferred = await getAppInitDeferred(userId);

      if (deferred.timelineData) {
        setInitTimelineData({
          facts: deferred.timelineData.facts || [],
          trivia: deferred.timelineData.trivia || [],
          pagination: deferred.timelinePagination,
          familySides: deferred.familySides || {},
        });
        logger.info('Deferred timeline data loaded', {
          facts: deferred.timelineData.facts?.length || 0,
          trivia: deferred.timelineData.trivia?.length || 0,
        });
      }
      if (deferred.catchupStatus) {
        setInitCatchupStatus(deferred.catchupStatus);
      }
      if (deferred.gameStatuses) {
        setInitGameStatuses(deferred.gameStatuses);
      }
      if (deferred.familyFeud) {
        setInitFamilyFeud(deferred.familyFeud);
      }
    } catch (error) {
      logger.error('Error loading deferred init data:', error);
      // Non-fatal — contexts will fall back to their own fetches
    }
  }, []);

  // Load critical data via /app-init
  const loadAllMembers = useCallback(async (forceRefresh = false) => {
    // Skip if already loading and not forcing refresh
    if (loadingRef.current && !forceRefresh) {
      logger.debug('Member load already in progress, skipping duplicate call');
      return;
    }

    // Limit retry attempts
    if (attemptsRef.current >= 2 && !forceRefresh) {
      setAppInitLoading(false);
      return;
    }

    loadingRef.current = true;
    setAppInitLoading(true);

    try {
      setLoadError(null);

      if (forceRefresh) api.clearApiCache();
      attemptsRef.current++;

      // CRITICAL init — fast, blocks first paint
      const initData: AppInitResponse = await getAppInit(userIdProp || undefined);

      // --- Season status ---
      if (initData.seasonStatus) {
        setSeasonStatus(initData.seasonStatus);
        logger.info('Season status loaded', {
          isEndOfSeason: initData.seasonStatus.isEndOfSeason,
          isBetweenSeasons: initData.seasonStatus.isBetweenSeasons,
        });
      }
      // --- First run detection ---
      if (initData.isFirstRun) {
        setIsFirstRun(true);
      }

      // --- User config ---
      const userConfig = initData.userConfig || null;
      if (userConfig) {
        logger.info('User configuration loaded successfully');
        // Store in cache for useApp.ts to read myGroup/isAdmin
        cacheService.set('user-config', userConfig);
      }

      // --- Hierarchy ---
      let hierarchy: ApiFamilyHierarchy | null = null;
      if (initData.hierarchy?.hierarchy) {
        const rawHierarchy = initData.hierarchy.hierarchy;
        if ('version' in rawHierarchy && 'family' in rawHierarchy) {
          hierarchy = rawHierarchy as ApiFamilyHierarchy;
        }
      }

      if (!hierarchy) {
        logger.warn('No hierarchy data in app-init response');
        setLoadError('No family members found. Please try refreshing the page.');
        return;
      }

      setHierarchyData(hierarchy);
      cacheService.set('family_hierarchy', hierarchy);

      const familyData = hierarchy.family as unknown as { sides?: Record<string, unknown> };
      if (familyData.sides) {
        logger.info('Family sides loaded:', Object.keys(familyData.sides));
      }

      // --- Build members ---
      const familyMembers = buildMembers(hierarchy, userConfig);

      if (familyMembers.length === 0) {
        logger.warn('No family data found in hierarchy response');
        setLoadError('No family members found. Please try refreshing the page.');
        return;
      }

      logger.info(`Found ${familyMembers.length} members from hierarchy data`);

      // --- Apply activation status ---
      const memberStatusMap = new Map<string, boolean>();
      if (initData.memberActivation) {
        Object.values(initData.memberActivation).forEach((statuses) => {
          statuses.forEach((status) => {
            memberStatusMap.set(status.userId, status.activated);
          });
        });
      }

      const membersWithActivation = familyMembers.map((member) => ({
        ...member,
        activated: memberStatusMap.get(member.userId) ?? false,
      }));

      setMembers(membersWithActivation);

      // --- Critical init data ---
      if (initData.questionAvailability) {
        setInitInitQuestionAvailability(initData.questionAvailability);
      }
      if (initData.categories) {
        setInitCategories(initData.categories);
      }
      if (initData.userCategories) {
        setInitUserCategories(initData.userCategories);
      }

      // --- Group descriptions ---
      if (initData.groupDescriptions && Object.keys(initData.groupDescriptions).length > 0) {
        setGroupDescriptions(initData.groupDescriptions);
        logger.info('Group descriptions loaded from app-init');
      }

      // Mark critical init as complete — app can render now
      setAppInitComplete(true);
      attemptsRef.current = 0;

      // --- Fire deferred load in background (timeline, catchup, games, feud) ---
      if (userIdProp) {
        loadDeferredData(userIdProp);
      }
    } catch (error) {
      logger.error('Error loading app init data:', error);
      setLoadError(
        'An error occurred while loading family members. Please try refreshing the page.',
      );
    } finally {
      setAppInitLoading(false);
      loadingRef.current = false;
    }
  }, [userIdProp, loadDeferredData]);

  // Load group descriptions (non-blocking, called after members are ready)
  const loadGroupDescriptionsFromGroups = useCallback(async (groups: string[]) => {
    try {
      logger.info('Loading all group descriptions in bulk');
      const allDescriptions = await api.getAllGroupDescriptions();

      if (allDescriptions && Object.keys(allDescriptions).length > 0) {
        setGroupDescriptions((prev) => ({ ...prev, ...allDescriptions }));
        return;
      }
    } catch (error) {
      logger.info('Could not load all descriptions at once, falling back to parallel loading');
    }

    // Fallback: load individually in parallel
    try {
      const results = await Promise.all(
        groups.map(async (groupId) => {
          try {
            const response = await api.getGroupDescription(groupId);
            if (response && response.description !== undefined) {
              return [
                groupId,
                {
                  description: response.description,
                  lastUpdated: response.lastUpdated || new Date().toISOString(),
                },
              ] as [string, GroupDescription];
            }
            return null;
          } catch (err) {
            logger.error(`Error loading description for group ${groupId}:`, err);
            return null;
          }
        }),
      );

      const descriptions: Record<string, GroupDescription> = {};
      results.forEach((result) => {
        if (result) {
          descriptions[result[0]] = result[1];
        }
      });

      if (Object.keys(descriptions).length > 0) {
        setGroupDescriptions((prev) => ({ ...prev, ...descriptions }));
      }
    } catch (error) {
      logger.error('Error loading group descriptions:', error);
    }
  }, []);

  // Public: refresh group descriptions
  const loadGroupDescriptions = useCallback(async () => {
    const groups = new Set<string>();
    members.forEach((member) => {
      if (member.group) groups.add(member.group);
    });

    if (groups.size === 0) return;

    await loadGroupDescriptionsFromGroups(Array.from(groups));
  }, [members, loadGroupDescriptionsFromGroups]);

  // Public: refresh hierarchy only
  const loadHierarchy = useCallback(async (forceRefresh = false) => {
    try {
      const hierarchy = await api.getFamilyHierarchy(forceRefresh);
      setHierarchyData(hierarchy);
      cacheService.set('family_hierarchy', hierarchy);

      const familyData = hierarchy.family as unknown as { sides?: Record<string, unknown> };
      if (familyData.sides) {
        logger.info('Family sides loaded:', Object.keys(familyData.sides));
      } else {
        logger.warn('No family sides found in hierarchy data');
      }
    } catch (error) {
      logger.error('Error loading family hierarchy:', error);
    }
  }, []);

  // Public refresh methods
  const refreshMembers = useCallback(
    (forceRefresh = false) => loadAllMembers(forceRefresh),
    [loadAllMembers],
  );

  const refreshHierarchy = useCallback(
    (forceRefresh = false) => loadHierarchy(forceRefresh),
    [loadHierarchy],
  );

  const refreshGroupDescriptions = useCallback(
    () => loadGroupDescriptions(),
    [loadGroupDescriptions],
  );

  // Update member activation status
  const updateMemberActivation = useCallback((userId: string, activated: boolean) => {
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, activated } : m)));
  }, []);

  // Clear error handler
  const clearError = useCallback(() => {
    setLoadError(null);
  }, []);

  // Initial load
  useEffect(() => {
    loadAllMembers();
  }, [loadAllMembers]);

  // Context value
  const value: FamilyDataContextType = {
    members,
    loadingMembers: appInitLoading,
    hierarchyData,
    groupDescriptions,
    loadError,
    seasonStatus,
    loadingSeasonStatus: appInitLoading,
    appInitComplete,
    isFirstRun,
    initTimelineData,
    initCatchupStatus,
    initQuestionAvailability,
    initCategories,
    initUserCategories,
    initGameStatuses,
    initFamilyFeud,
    refreshMembers,
    refreshHierarchy,
    refreshGroupDescriptions,
    updateMemberActivation,
    clearError,
  };

  return <FamilyDataContext.Provider value={value}>{children}</FamilyDataContext.Provider>;
};

// Custom hook to use the context
export const useFamilyData = (): FamilyDataContextType => {
  const context = useContext(FamilyDataContext);
  if (context === undefined) {
    throw new Error('useFamilyData must be used within a FamilyDataProvider');
  }
  return context;
};
