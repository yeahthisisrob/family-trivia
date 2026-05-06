import React, { createContext, useContext, useState } from 'react';

import { cacheService } from '../services/CacheService';

interface CategoryRefreshContextType {
  refreshTimestamp: number;
  invalidateCategories: () => void;
}

const CategoryRefreshContext = createContext<CategoryRefreshContextType | undefined>(undefined);

export const CategoryRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshTimestamp, setRefreshTimestamp] = useState<number>(0);

  // Use React.useCallback to memoize this function to prevent unnecessary re-renders
  const invalidateCategories = React.useCallback(() => {
    // Clear any category cache entries more efficiently with pattern matching
    cacheService.invalidatePattern('categories_');

    // Update timestamp to trigger component refreshes
    setRefreshTimestamp(Date.now());
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(
    () => ({ refreshTimestamp, invalidateCategories }),
    [refreshTimestamp, invalidateCategories],
  );

  return (
    <CategoryRefreshContext.Provider value={contextValue}>
      {children}
    </CategoryRefreshContext.Provider>
  );
};

export const useCategoryRefresh = (): CategoryRefreshContextType => {
  const context = useContext(CategoryRefreshContext);
  if (context === undefined) {
    throw new Error('useCategoryRefresh must be used within a CategoryRefreshProvider');
  }
  return context;
};
