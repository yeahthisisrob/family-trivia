import type { Family } from '@family-trivia/shared';
import { useCallback, useEffect, useState } from 'react';
import { type FamilyResponse, familyApi } from '../api/familyApi';

/** Load the family once; `reload` after a save elsewhere. */
export function useFamily() {
  const [data, setData] = useState<FamilyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await familyApi.get());
      setError(null);
    } catch {
      setError("The family didn't load. Try again in a moment.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    family: data?.family ?? null,
    photoUrls: data?.photoUrls ?? {},
    error,
    reload,
    replace: (family: Family, photoUrls?: Record<string, string>) =>
      setData((d) => ({ family, photoUrls: photoUrls ?? d?.photoUrls ?? {} })),
  };
}
