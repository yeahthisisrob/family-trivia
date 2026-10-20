import type React from 'react';
import { createContext, useCallback, useContext, useMemo } from 'react';

import { cacheService } from '../shared/api/CacheService';

interface CategoryRefreshContextType {
  invalidateCategories: () => void;
}

const CategoryRefreshContext = createContext<CategoryRefreshContextType | undefined>(undefined);

/**
 * Drops the cached category lists (a custom category was added, or a pick
 * counts against a category). Reads on server data ask again through their
 * own invalidations (docs/decisions/0035).
 */
export const CategoryRefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const invalidateCategories = useCallback(() => {
    cacheService.invalidatePattern('categories_');
  }, []);

  const contextValue = useMemo(() => ({ invalidateCategories }), [invalidateCategories]);

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
