/**
 * The circle's settings as server data (docs/decisions/0035, 0013): which
 * optional parts of the app are on, for everyone, and (admins) every setting
 * with where its value comes from and the AI picture. A save puts the saved
 * view in the cache and asks again for what the settings decide: the
 * features every screen reads and the backups view (nightly backups).
 */
import type { SettingValue } from '@family-trivia/shared';
import { callApi, type ResponseOf } from '../../../shared/api/contract';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';

export type AdminSettings = ResponseOf<'/admin/settings'>;
export type Features = { photos: boolean; familyFeud: boolean; arcade: boolean };
const ALL_ON: Features = { photos: true, familyFeud: true, arcade: true };

const SETTINGS = ['settings'] as const;
const FEATURES = [...SETTINGS, 'features'] as const;
const ADMIN_VIEW = [...SETTINGS, 'admin'] as const;
/** The backups view shows whether nightly backups are on (a setting). */
export const BACKUPS = ['backups'] as const;

const withAllOn = (features: ResponseOf<'/settings/features'>): Features => ({
  ...ALL_ON,
  ...features,
});

/** Which optional parts of the app are on; everything shows until it knows. */
export const useFeatures = (): Features =>
  useCircleQuery({ key: FEATURES, path: '/settings/features', select: withAllOn }).data ?? ALL_ON;

export const useAdminSettings = () => useCircleQuery({ key: ADMIN_VIEW, path: '/admin/settings' });

/** Save the draft; the answer is the view after saving. Never retried. */
export const useSaveSettings = () =>
  useCircleMutation({
    mutationFn: (values: Record<string, SettingValue>) =>
      callApi('/admin/settings', { method: 'put', once: true, body: { values } }),
    onSuccess: (saved, _values, cache) => cache.set(ADMIN_VIEW, () => saved),
    invalidates: [FEATURES, BACKUPS],
  });

/** Ask Bedrock again which models work; the answer is the whole view. */
export const useCheckModels = () =>
  useCircleMutation({
    mutationFn: () => callApi('/admin/settings', { query: { refreshModels: '1' } }),
    onSuccess: (checked, _vars, cache) => cache.set(ADMIN_VIEW, () => checked),
  });
