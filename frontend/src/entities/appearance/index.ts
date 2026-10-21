/**
 * The circle's default theme as server data (backend/features/appearance,
 * docs/decisions/0035): everyone sees it unless they pick their own.
 */
import { callApi } from '../../shared/api/contract';
import { useCircleMutation, useCircleQuery } from '../../shared/api/query';

const APPEARANCE = ['appearance'] as const;

/** The family's theme id (null for the default); asked once signed in. */
export const useFamilyThemeId = (enabled: boolean) =>
  useCircleQuery({
    key: APPEARANCE,
    path: '/appearance',
    enabled,
    select: (answer) => answer.themeId,
  });

/** Admins choose it; the saved choice is what everyone's read shows next. */
export const useSaveFamilyTheme = () =>
  useCircleMutation({
    mutationFn: (themeId: string | null) =>
      callApi('/admin/appearance', { method: 'put', once: true, body: { themeId } }),
    onSuccess: (saved, _themeId, cache) => cache.set(APPEARANCE, () => saved),
  });
