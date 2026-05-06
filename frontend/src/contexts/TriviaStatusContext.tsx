import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

import { useCategoryRefresh } from './CategoryRefreshContext';
import { useFamilyData } from './FamilyDataContext';
import { getCasinoRushStatus, getCurlingStatus, getSlotMachineStatus, getTetrisStatus } from '../api/modules/games';
import { cacheService } from '../services/CacheService';
import { createLogger } from '../utils/logger';

const logger = createLogger('TriviaStatusContext');

interface TriviaStatusState {
  // Slot Machine state
  slotMachine: {
    canPlay: boolean;
    nextAvailable: Date | null;
    hasActiveSession: boolean;
    loading: boolean;
    lastUpdated: number;
  };

  // Casino Rush state
  casinoRush: {
    canPlay: boolean;
    nextAvailable: Date | null;
    hasActiveSession: boolean;
    loading: boolean;
    lastUpdated: number;
  };

  // Curling state
  curling: {
    canPlay: boolean;
    nextAvailable: Date | null;
    loading: boolean;
    lastUpdated: number;
  };

  // Tetris state
  tetris: {
    canPlay: boolean;
    nextAvailable: Date | null;
    loading: boolean;
    lastUpdated: number;
  };
}

interface TriviaStatusContextType extends TriviaStatusState {
  // Refresh methods — pass force=true to bypass the 15s cache
  // (required after completing a game mode so cooldown appears immediately)
  refreshSlotMachineStatus: (userId: string, force?: boolean) => Promise<void>;
  refreshCasinoRushStatus: (userId: string, force?: boolean) => Promise<void>;
  refreshCurlingStatus: (userId: string, force?: boolean) => Promise<void>;
  refreshTetrisStatus: (userId: string, force?: boolean) => Promise<void>;
  refreshAllStatuses: (userId: string, force?: boolean) => Promise<void>;

  // Merged from CategoryRefreshContext
  refreshCategories: () => void;
}

const TriviaStatusContext = createContext<TriviaStatusContextType | undefined>(undefined);

// Cache duration in milliseconds (15 seconds)
const STATUS_CACHE_DURATION = 15000;

export const TriviaStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Include the CategoryRefreshContext functionality
  const { refreshTimestamp, invalidateCategories } = useCategoryRefresh();

  // State for slot machine status
  const [slotMachineStatus, setSlotMachineStatus] = useState<{
    canPlay: boolean;
    nextAvailable: Date | null;
    hasActiveSession: boolean;
    loading: boolean;
    lastUpdated: number;
  }>({
    canPlay: false,
    nextAvailable: null,
    hasActiveSession: false,
    loading: true,
    lastUpdated: 0,
  });

  // State for casino rush status
  const [casinoRushStatus, setCasinoRushStatus] = useState<{
    canPlay: boolean;
    nextAvailable: Date | null;
    hasActiveSession: boolean;
    loading: boolean;
    lastUpdated: number;
  }>({
    canPlay: false,
    nextAvailable: null,
    hasActiveSession: false,
    loading: true,
    lastUpdated: 0,
  });

  // State for curling status
  const [curlingStatus, setCurlingStatus] = useState<{
    canPlay: boolean;
    nextAvailable: Date | null;
    loading: boolean;
    lastUpdated: number;
  }>({
    canPlay: false,
    nextAvailable: null,
    loading: true,
    lastUpdated: 0,
  });

  // State for tetris status
  const [tetrisStatus, setTetrisStatus] = useState<{
    canPlay: boolean;
    nextAvailable: Date | null;
    loading: boolean;
    lastUpdated: number;
  }>({
    canPlay: false,
    nextAvailable: null,
    loading: true,
    lastUpdated: 0,
  });

  // Hydrate game statuses from app-init (no separate API calls)
  const { initGameStatuses, appInitComplete } = useFamilyData();
  const gameStatusHydratedRef = useRef(false);

  useEffect(() => {
    if (gameStatusHydratedRef.current || !appInitComplete || !initGameStatuses) return;
    gameStatusHydratedRef.current = true;

    setCasinoRushStatus({
      canPlay: initGameStatuses.casinoRush.canPlay,
      nextAvailable: initGameStatuses.casinoRush.nextAvailable
        ? new Date(initGameStatuses.casinoRush.nextAvailable) : null,
      hasActiveSession: initGameStatuses.casinoRush.hasActiveSession,
      loading: false,
      lastUpdated: Date.now(),
    });

    setSlotMachineStatus({
      canPlay: initGameStatuses.slotMachine.canPlay,
      nextAvailable: initGameStatuses.slotMachine.nextAvailable
        ? new Date(initGameStatuses.slotMachine.nextAvailable) : null,
      hasActiveSession: initGameStatuses.slotMachine.hasActiveSession,
      loading: false,
      lastUpdated: Date.now(),
    });

    if (initGameStatuses.curling) {
      setCurlingStatus({
        canPlay: initGameStatuses.curling.canPlay,
        nextAvailable: initGameStatuses.curling.nextAvailable
          ? new Date(initGameStatuses.curling.nextAvailable) : null,
        loading: false,
        lastUpdated: Date.now(),
      });
    }

    if (initGameStatuses.tetris) {
      setTetrisStatus({
        canPlay: initGameStatuses.tetris.canPlay,
        nextAvailable: initGameStatuses.tetris.nextAvailable
          ? new Date(initGameStatuses.tetris.nextAvailable) : null,
        loading: false,
        lastUpdated: Date.now(),
      });
    }
  }, [appInitComplete, initGameStatuses]);

  // Refresh slot machine status — always hits the backend.
  // Client caching was causing stale status on mobile after game completion.
  // Backend has its own per-invocation cache so this is cheap.
  const refreshSlotMachineStatus = useCallback(
    async (userId: string, _force = true) => {
      try {
        setSlotMachineStatus((prev) => ({ ...prev, loading: true }));

        const status = await getSlotMachineStatus(userId, true);

        setSlotMachineStatus({
          canPlay: status?.canPlay ?? false,
          nextAvailable: status?.nextAvailable ? new Date(status.nextAvailable) : null,
          hasActiveSession: status?.activeSession?.hasActiveSession ?? false,
          loading: false,
          lastUpdated: Date.now(),
        });
      } catch (error) {
        logger.error('Error fetching slot machine status:', error);

        // Set error state but maintain previous data
        setSlotMachineStatus((prev) => ({
          ...prev,
          loading: false,
          lastUpdated: Date.now(),
        }));
      }
    },
    [],
  );

  // Refresh casino rush status — always hits the backend.
  const refreshCasinoRushStatus = useCallback(
    async (userId: string, _force = true) => {
      try {
        setCasinoRushStatus((prev) => ({ ...prev, loading: true }));

        const status = await getCasinoRushStatus(userId, true);

        setCasinoRushStatus({
          canPlay: status?.canPlay ?? false,
          nextAvailable:
            status?.nextAvailable instanceof Date
              ? status.nextAvailable
              : status?.nextAvailable
                ? new Date(status.nextAvailable)
                : null,
          hasActiveSession: status?.activeSession !== undefined,
          loading: false,
          lastUpdated: Date.now(),
        });
      } catch (error) {
        logger.error('Error fetching casino rush status:', error);

        // Set error state but maintain previous data
        setCasinoRushStatus((prev) => ({
          ...prev,
          loading: false,
          lastUpdated: Date.now(),
        }));
      }
    },
    [],
  );

  // Refresh curling status — always hits the backend.
  const refreshCurlingStatus = useCallback(
    async (userId: string, _force = true) => {
      try {
        setCurlingStatus((prev) => ({ ...prev, loading: true }));
        const status = await getCurlingStatus(userId);
        setCurlingStatus({
          canPlay: status?.canPlay ?? false,
          nextAvailable: status?.nextAvailable ? new Date(status.nextAvailable) : null,
          loading: false,
          lastUpdated: Date.now(),
        });
      } catch (error) {
        logger.error('Error fetching curling status:', error);
        setCurlingStatus((prev) => ({ ...prev, loading: false, lastUpdated: Date.now() }));
      }
    },
    [],
  );

  // Refresh tetris status
  const refreshTetrisStatus = useCallback(
    async (userId: string, _force = true) => {
      try {
        setTetrisStatus((prev) => ({ ...prev, loading: true }));
        const status = await getTetrisStatus(userId);
        setTetrisStatus({
          canPlay: status?.canPlay ?? false,
          nextAvailable: status?.nextAvailable ? new Date(status.nextAvailable) : null,
          loading: false,
          lastUpdated: Date.now(),
        });
      } catch (error) {
        logger.error('Error fetching tetris status:', error);
        setTetrisStatus((prev) => ({ ...prev, loading: false, lastUpdated: Date.now() }));
      }
    },
    [],
  );

  // Refresh all game statuses
  const refreshAllStatuses = useCallback(
    async (userId: string) => {
      try {
        await Promise.all([
          refreshSlotMachineStatus(userId),
          refreshCasinoRushStatus(userId),
          refreshCurlingStatus(userId),
          refreshTetrisStatus(userId),
        ]);
      } catch (error) {
        logger.error('Error refreshing game statuses:', error);
      }
    },
    [refreshSlotMachineStatus, refreshCasinoRushStatus, refreshCurlingStatus, refreshTetrisStatus],
  );

  // Refresh categories function (merged from CategoryRefreshContext)
  const refreshCategories = useCallback(() => {
    // This function simply calls the invalidateCategories function
    // from the CategoryRefreshContext
    invalidateCategories();
  }, [invalidateCategories]);

  // Handle refresh timestamp changes from CategoryRefreshContext at render time
  const [prevRefreshTimestamp, setPrevRefreshTimestamp] = useState(refreshTimestamp);
  if (refreshTimestamp !== prevRefreshTimestamp) {
    setPrevRefreshTimestamp(refreshTimestamp);
    if (refreshTimestamp > 0) {
      logger.debug('Category refresh detected, clearing trivia status cache');

      // Clear cache keys for both status APIs
      Object.keys(cacheService['cache'] || {}).forEach((key) => {
        if (key.startsWith('slot_machine_status_') || key.startsWith('casino_rush_status_')) {
          cacheService.invalidate(key);
        }
      });

      // Reset our last updated timestamps to force refetching
      setSlotMachineStatus((prev) => ({ ...prev, lastUpdated: 0 }));
      setCasinoRushStatus((prev) => ({ ...prev, lastUpdated: 0 }));
    }
  }

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(
    () => ({
      slotMachine: slotMachineStatus,
      casinoRush: casinoRushStatus,
      curling: curlingStatus,
      tetris: tetrisStatus,
      refreshSlotMachineStatus,
      refreshCasinoRushStatus,
      refreshCurlingStatus,
      refreshTetrisStatus,
      refreshAllStatuses,
      refreshCategories,
    }),
    [
      slotMachineStatus,
      casinoRushStatus,
      curlingStatus,
      tetrisStatus,
      refreshSlotMachineStatus,
      refreshCasinoRushStatus,
      refreshCurlingStatus,
      refreshTetrisStatus,
      refreshAllStatuses,
      refreshCategories,
    ],
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

// Additional hook specifically for slot machine
export const useSlotMachineStatus = (userId?: string, autoFetch = false) => {
  const { slotMachine, refreshSlotMachineStatus } = useTriviaStatus();

  // Only fetch data automatically if explicitly requested
  useEffect(() => {
    if (userId && autoFetch) {
      refreshSlotMachineStatus(userId);
    }
  }, [userId, refreshSlotMachineStatus, autoFetch]);

  return {
    ...slotMachine,
    refresh: userId ? () => refreshSlotMachineStatus(userId) : () => Promise.resolve(),
  };
};

// Additional hook specifically for casino rush
export const useCasinoRushStatus = (userId?: string, autoFetch = false) => {
  const { casinoRush, refreshCasinoRushStatus } = useTriviaStatus();

  // Only fetch data automatically if explicitly requested
  useEffect(() => {
    if (userId && autoFetch) {
      refreshCasinoRushStatus(userId);
    }
  }, [userId, refreshCasinoRushStatus, autoFetch]);

  return {
    ...casinoRush,
    refresh: userId ? () => refreshCasinoRushStatus(userId) : () => Promise.resolve(),
  };
};
