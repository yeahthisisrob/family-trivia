import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getRoundStatus } from '../games/kit';
import { GAMES } from '../games/registry';
import { createLogger } from '../shared/lib/logger';
import { useCategoryRefresh } from './CategoryRefreshContext';
import { useFamilyData } from './FamilyDataContext';

const logger = createLogger('TriviaStatusContext');

/** A game played as this week's round (docs/decisions/0032). */
export interface RoundState {
  canPlay: boolean;
  nextAvailable: Date | null;
  /** A play with steps of its own was started and not finished: opening it resumes. */
  active: boolean;
  loading: boolean;
}

const ROUND_GAMES = GAMES.filter((g) => g.round).map((g) => g.id);

interface TriviaStatusContextType {
  /** Every game with a round, by id: from the game folders. */
  rounds: Record<string, RoundState>;
  // Always hits the backend (required after a play so the cooldown shows at once)
  refreshRounds: () => Promise<void>;
  refreshAllStatuses: (userId: string) => Promise<void>;

  // Merged from CategoryRefreshContext
  refreshCategories: () => void;
}

const TriviaStatusContext = createContext<TriviaStatusContextType | undefined>(undefined);

export const TriviaStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Include the CategoryRefreshContext functionality
  const { invalidateCategories } = useCategoryRefresh();

  const [rounds, setRounds] = useState<Record<string, RoundState>>(() =>
    Object.fromEntries(
      ROUND_GAMES.map((id) => [
        id,
        { canPlay: false, nextAvailable: null, active: false, loading: true },
      ]),
    ),
  );

  const { appInitComplete } = useFamilyData();

  // Rounds: one request for every game that has one.
  const refreshRounds = useCallback(async () => {
    try {
      const status = await getRoundStatus(ROUND_GAMES);
      setRounds(
        Object.fromEntries(
          ROUND_GAMES.map((id) => [
            id,
            {
              canPlay: status[id]?.canPlay ?? false,
              nextAvailable: status[id]?.nextAvailable ? new Date(status[id].nextAvailable) : null,
              active: status[id]?.active ?? false,
              loading: false,
            },
          ]),
        ),
      );
    } catch (error) {
      logger.error('Error fetching round statuses:', error);
      setRounds((prev) =>
        Object.fromEntries(Object.entries(prev).map(([id, r]) => [id, { ...r, loading: false }])),
      );
    }
  }, []);

  // App-init doesn't carry rounds: ask once it's done.
  useEffect(() => {
    if (appInitComplete) void refreshRounds();
  }, [appInitComplete, refreshRounds]);

  // Refresh all game statuses
  const refreshAllStatuses = useCallback(
    async (_userId: string) => {
      try {
        await refreshRounds();
      } catch (error) {
        logger.error('Error refreshing game statuses:', error);
      }
    },
    [refreshRounds],
  );

  // Refresh categories function (merged from CategoryRefreshContext)
  const refreshCategories = useCallback(() => {
    // This function simply calls the invalidateCategories function
    // from the CategoryRefreshContext
    invalidateCategories();
  }, [invalidateCategories]);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(
    () => ({ rounds, refreshRounds, refreshAllStatuses, refreshCategories }),
    [rounds, refreshRounds, refreshAllStatuses, refreshCategories],
  );

  return (
    <TriviaStatusContext.Provider value={contextValue}>{children}</TriviaStatusContext.Provider>
  );
};

// Hook for consuming the context
export const useTriviaStatus = (): TriviaStatusContextType => {
  const context = useContext(TriviaStatusContext);
  if (context === undefined) {
    throw new Error('useTriviaStatus must be used within a TriviaStatusProvider');
  }
  return context;
};
