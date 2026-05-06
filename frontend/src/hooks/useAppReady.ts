import { useFamilyData } from '../contexts/FamilyDataContext';

export function useAppReady() {
  const { appInitComplete } = useFamilyData();

  // Critical init (config, hierarchy, season, activation) is enough for first paint.
  // Timeline, catchup, and game statuses load in background via /app-init-deferred
  // and each context handles its own loading state independently.
  return { isAppReady: appInitComplete };
}
