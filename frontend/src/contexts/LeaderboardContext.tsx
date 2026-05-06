// File: src/contexts/LeaderboardContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

import { getOptimizedLeaderboardData, SeasonInfo } from '../api/modules/leaderboard';
import { LeaderboardEntry, GroupScore } from '../components/Leaderboard/utils';
import { createLogger } from '../utils/logger';

// Initialize logger
const logger = createLogger('LeaderboardContext');

// Context type
interface LeaderboardContextType {
  // Data
  players: LeaderboardEntry[];
  groups: GroupScore[];
  userGroups: Record<string, string>;
  seasons: SeasonInfo[];
  selectedSeason: number | undefined;
  maxQuestionsAsked: number | undefined;
  globalCategoryStats: Record<string, { total: number; correct: number }>;
  loading: boolean;
  error: string | null;

  // Actions
  setSelectedSeason: (season: number | undefined) => void;
  refreshLeaderboard: () => void;
  clearError: () => void;
}

// Create context with default values
export const LeaderboardContext = createContext<LeaderboardContextType>({
  players: [],
  groups: [],
  userGroups: {},
  seasons: [],
  selectedSeason: undefined,
  maxQuestionsAsked: undefined,
  globalCategoryStats: {},
  loading: true,
  error: null,
  setSelectedSeason: () => {
    logger.debug('Default setSelectedSeason called');
  },
  refreshLeaderboard: () => {
    logger.debug('Default refreshLeaderboard called');
  },
  clearError: () => {
    logger.debug('Default clearError called');
  },
});

interface LeaderboardProviderProps {
  children: React.ReactNode;
}

export const LeaderboardProvider: React.FC<LeaderboardProviderProps> = ({ children }) => {
  // State
  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [groups, setGroups] = useState<GroupScore[]>([]);
  const [userGroups, setUserGroups] = useState<Record<string, string>>({});
  const [seasons, setSeasons] = useState<SeasonInfo[]>([]);
  const [selectedSeason, setSelectedSeasonState] = useState<number | undefined>(undefined);
  const [maxQuestionsAsked, setMaxQuestionsAsked] = useState<number | undefined>(undefined);
  const [globalCategoryStats, setGlobalCategoryStats] = useState<Record<string, { total: number; correct: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Track whether we've initialized the default season
  const initializedSeasonRef = useRef(false);

  // Refs to track loading state and prevent duplicate requests
  const fetchAttemptsRef = useRef(0);
  const maxFetchAttempts = 3; // Maximum number of retry attempts
  const loadingRef = useRef(false);
  const hasDataRef = useRef(false);

  // Fetch leaderboard data with retry logic
  const fetchLeaderboardData = useCallback(
    async (forceRefresh = false, seasonOverride?: number | undefined) => {
      // Determine which season to use
      const seasonToFetch = seasonOverride !== undefined ? seasonOverride : selectedSeason;

      // Skip if already loading or we have data and don't need to refresh
      if (loadingRef.current && !forceRefresh) return;
      if (!forceRefresh && hasDataRef.current) {
        setLoading(false);
        return;
      }

      // Track retry attempts
      if (fetchAttemptsRef.current >= maxFetchAttempts && !forceRefresh) {
        setLoading(false);
        setError('Could not load leaderboard data after multiple attempts.');
        logger.error('Max fetch attempts reached for leaderboard data');
        return;
      }

      // Set loading state
      loadingRef.current = true;
      setLoading(true);

      // Clear error on fresh attempt
      if (forceRefresh) {
        setError(null);
      }

      // Increment attempt counter
      fetchAttemptsRef.current += 1;
      logger.info(
        `Fetching leaderboard data (attempt ${fetchAttemptsRef.current}/${maxFetchAttempts}, season=${seasonToFetch ?? 'all'})`,
      );

      try {
        // Get consolidated data
        const {
          players: fetchedPlayers,
          groups: fetchedGroups,
          userGroups: fetchedUserGroups,
          seasons: fetchedSeasons,
          maxQuestionsAsked: fetchedMaxQuestions,
          globalCategoryStats: fetchedGlobalCategoryStats,
        } = await getOptimizedLeaderboardData(seasonToFetch);

        // Validate data - separate validation for players and groups
        const hasValidPlayers =
          fetchedPlayers && Array.isArray(fetchedPlayers) && fetchedPlayers.length > 0;
        const hasValidGroups =
          fetchedGroups && Array.isArray(fetchedGroups) && fetchedGroups.length > 0;

        if (hasValidPlayers && hasValidGroups) {
          // Store the data
          setPlayers(fetchedPlayers);
          setGroups(fetchedGroups);
          setUserGroups(fetchedUserGroups);
          setMaxQuestionsAsked(fetchedMaxQuestions);
          setGlobalCategoryStats(fetchedGlobalCategoryStats || {});

          // Update seasons list
          if (fetchedSeasons && fetchedSeasons.length > 0) {
            setSeasons(fetchedSeasons);

            // Auto-select the active (or latest concluded) season on first load,
            // then refetch with that season filter so data is scoped correctly.
            if (!initializedSeasonRef.current) {
              initializedSeasonRef.current = true;
              const active = fetchedSeasons.find((s) => s.status === 'active');
              const concluded = fetchedSeasons
                .filter((s) => s.status === 'concluded')
                .sort((a, b) => b.seasonNumber - a.seasonNumber);
              const defaultSeason = active || concluded[0];
              if (defaultSeason && seasonToFetch === undefined) {
                // First fetch was unfiltered — refetch with season filter
                setSelectedSeasonState(defaultSeason.seasonNumber);
                loadingRef.current = false;
                fetchAttemptsRef.current = 0;
                fetchLeaderboardData(true, defaultSeason.seasonNumber);
                return;
              }
            }
          }

          // Update state flags
          hasDataRef.current = true;
          fetchAttemptsRef.current = 0; // Reset attempts on success

          logger.info(
            `Successfully loaded leaderboard data: ${fetchedPlayers.length} players, ${fetchedGroups.length} groups`,
          );

          // Log group averages for debugging
          const groupsWithZeroAvg = fetchedGroups.filter((g) => g.averageScore === 0);
          if (groupsWithZeroAvg.length > 0) {
            logger.warn(`Found ${groupsWithZeroAvg.length} groups with 0 average score`, {
              groups: groupsWithZeroAvg.map((g) => ({
                groupId: g.groupId,
                memberCount: g.memberCount,
                activeMemberCount: g.activeMemberCount,
              })),
            });
          }
        } else {
          // Handle incomplete data - retry if we haven't hit the limit
          logger.warn('Received incomplete leaderboard data', {
            playersCount: fetchedPlayers?.length || 0,
            groupsCount: fetchedGroups?.length || 0,
          });

          if (fetchAttemptsRef.current < maxFetchAttempts) {
            logger.info(
              `Retrying in 1 second (attempt ${fetchAttemptsRef.current}/${maxFetchAttempts})`,
            );
            setTimeout(() => fetchLeaderboardData(forceRefresh, seasonToFetch), 1000);
            return;
          } else {
            setError('Unable to load complete leaderboard data. Please try refreshing.');
          }
        }
      } catch (error) {
        logger.error('Error fetching leaderboard data:', error);

        // Retry logic
        if (fetchAttemptsRef.current < maxFetchAttempts) {
          logger.info(
            `Error occurred, retrying in 1 second (attempt ${fetchAttemptsRef.current}/${maxFetchAttempts})`,
          );
          setTimeout(() => fetchLeaderboardData(forceRefresh, seasonToFetch), 1000);
          return;
        }

        // Set error message after max retries
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(`Failed to load leaderboard: ${errorMessage}`);
      } finally {
        // Only update loading state when we're done with all retries or successful
        if (fetchAttemptsRef.current >= maxFetchAttempts || fetchAttemptsRef.current === 0) {
          setLoading(false);
          loadingRef.current = false;
        }
      }
    },
    [selectedSeason],
  );

  // Set selected season and trigger refetch
  const setSelectedSeason = useCallback(
    (season: number | undefined) => {
      setSelectedSeasonState(season);
      hasDataRef.current = false; // Force refetch
      fetchAttemptsRef.current = 0;
      loadingRef.current = false;
      fetchLeaderboardData(true, season);
    },
    [fetchLeaderboardData],
  );

  // Public refresh method
  const refreshLeaderboard = useCallback(() => {
    logger.info('Manually refreshing leaderboard data');
    fetchAttemptsRef.current = 0; // Reset attempts counter
    setRefreshKey((prev) => prev + 1); // Trigger useEffect
    fetchLeaderboardData(true); // Force fresh data
  }, [fetchLeaderboardData]);

  // Clear error handler
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initial data load
  useEffect(() => {
    fetchAttemptsRef.current = 0; // Reset attempts counter on key change
    fetchLeaderboardData(false);
  }, [refreshKey, fetchLeaderboardData]);

  // Context value
  const contextValue = {
    players,
    groups,
    userGroups,
    seasons,
    selectedSeason,
    maxQuestionsAsked,
    globalCategoryStats,
    loading,
    error,
    setSelectedSeason,
    refreshLeaderboard,
    clearError,
  };

  return <LeaderboardContext.Provider value={contextValue}>{children}</LeaderboardContext.Provider>;
};

// Custom hook to use the context
export const useLeaderboard = (): LeaderboardContextType => {
  const context = useContext(LeaderboardContext);
  if (!context) {
    throw new Error('useLeaderboard must be used within a LeaderboardProvider');
  }
  return context;
};
