import React, { createContext, useContext, useCallback, useMemo } from 'react';

 
import { CategoryRefreshProvider, useCategoryRefresh } from './CategoryRefreshContext';
import { TriviaStatusProvider, useTriviaStatus } from './TriviaStatusContext';

// This is a composite context that combines both TriviaStatusContext and CategoryRefreshContext
// It provides a unified API for components to access all trivia-related state and functions

// Combine the types from both contexts
interface TriviaContextType {
  // From TriviaStatusContext
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
  curling: {
    canPlay: boolean;
    nextAvailable: Date | null;
    loading: boolean;
    lastUpdated: number;
  };
  tetris: {
    canPlay: boolean;
    nextAvailable: Date | null;
    loading: boolean;
    lastUpdated: number;
  };
  refreshSlotMachineStatus: (userId: string) => Promise<void>;
  refreshCasinoRushStatus: (userId: string) => Promise<void>;
  refreshCurlingStatus: (userId: string) => Promise<void>;
  refreshTetrisStatus: (userId: string) => Promise<void>;
  refreshAllStatuses: (userId: string) => Promise<void>;

  // From CategoryRefreshContext
  refreshTimestamp: number;
  invalidateCategories: () => void;
}

export const TriviaContext = createContext<TriviaContextType | undefined>(undefined);

// Inner provider component that consumes both contexts and exposes a unified API
const InnerTriviaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Get access to both contexts
  const triviaStatus = useTriviaStatus();
  const categoryRefresh = useCategoryRefresh();

  // Create a memoized combined context value
  const combinedValue = useMemo(
    () => ({
      // From TriviaStatusContext
      slotMachine: triviaStatus.slotMachine,
      casinoRush: triviaStatus.casinoRush,
      curling: triviaStatus.curling,
      tetris: triviaStatus.tetris,
      refreshSlotMachineStatus: triviaStatus.refreshSlotMachineStatus,
      refreshCasinoRushStatus: triviaStatus.refreshCasinoRushStatus,
      refreshCurlingStatus: triviaStatus.refreshCurlingStatus,
      refreshTetrisStatus: triviaStatus.refreshTetrisStatus,
      refreshAllStatuses: triviaStatus.refreshAllStatuses,

      // From CategoryRefreshContext
      refreshTimestamp: categoryRefresh.refreshTimestamp,
      invalidateCategories: categoryRefresh.invalidateCategories,
    }),
    [triviaStatus, categoryRefresh],
  );

  return <TriviaContext.Provider value={combinedValue}>{children}</TriviaContext.Provider>;
};

// Main provider component that wraps both context providers
export const TriviaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <CategoryRefreshProvider>
      <TriviaStatusProvider>
        <InnerTriviaProvider>{children}</InnerTriviaProvider>
      </TriviaStatusProvider>
    </CategoryRefreshProvider>
  );
};

// Hook for consuming the combined context
export const useTrivia = (): TriviaContextType => {
  const context = useContext(TriviaContext);
  if (context === undefined) {
    throw new Error('useTrivia must be used within a TriviaProvider');
  }
  return context;
};

// Specialized hook for slot machine status with automatic refresh
export const useSlotMachineStatus = (userId?: string) => {
  const { slotMachine, refreshSlotMachineStatus } = useTrivia();

  // Create a memoized refresh function that only changes when userId changes
  const refresh = useCallback(() => {
    if (userId) {
      return refreshSlotMachineStatus(userId);
    }
    return Promise.resolve();
  }, [userId, refreshSlotMachineStatus]);

  return {
    ...slotMachine,
    refresh,
  };
};

// Specialized hook for casino rush status with automatic refresh
export const useCasinoRushStatus = (userId?: string) => {
  const { casinoRush, refreshCasinoRushStatus } = useTrivia();

  // Create a memoized refresh function that only changes when userId changes
  const refresh = useCallback(() => {
    if (userId) {
      return refreshCasinoRushStatus(userId);
    }
    return Promise.resolve();
  }, [userId, refreshCasinoRushStatus]);

  return {
    ...casinoRush,
    refresh,
  };
};

// Re-export the individual context providers and hooks for cases where
// components only need one specific part of the trivia state
export { TriviaStatusProvider, useTriviaStatus, CategoryRefreshProvider, useCategoryRefresh };
