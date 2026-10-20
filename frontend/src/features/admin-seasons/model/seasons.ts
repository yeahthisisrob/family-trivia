/**
 * Seasons as an admin sees them, as server data (docs/decisions/0035): every
 * season, which one is current, and their letters. A change asks again for
 * every read that shows a season: the results and their season list, teams,
 * threads, today's question, who has played, and the season status that
 * /app-init carries (Home's banner and letters).
 */
import { uploadImage } from '../../../api/modules/admin';
import { useRefreshAppInit } from '../../../contexts/FamilyDataContext';
import { LEADERBOARD } from '../../../entities/leaderboard';
import { type BodyOf, callApi, type ResponseOf } from '../../../shared/api/contract';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { loadSession } from '../../../shared/session/session';
import { DAILY_QUESTION } from '../../daily-question';
import { TEAMS } from '../../teams';
import { THREADS } from '../../threads';
import { WHO_HAS_PLAYED } from '../../who-has-played';

const ADMIN_SEASONS = ['admin', 'seasons'] as const;

export type AdminSeason = ResponseOf<'/admin/seasons'>['seasons'][number];
/** A season to add or change; the admin's id is added here. */
export type SeasonChange = Omit<BodyOf<'/admin/seasons', 'put'>, 'adminUserId'>;
export type NewSeason = Omit<BodyOf<'/admin/seasons', 'post'>, 'adminUserId'>;

/** Every read that shows a season. */
const SHOWS_A_SEASON = [ADMIN_SEASONS, LEADERBOARD, TEAMS, THREADS, DAILY_QUESTION, WHO_HAS_PLAYED];

const adminUserId = () => loadSession() ?? '';

export const useAdminSeasons = () =>
  useCircleQuery({
    key: ADMIN_SEASONS,
    path: '/admin/seasons',
    query: { adminUserId: adminUserId() },
  });

/**
 * One season change (add, edit, letters, activate, delete). It never
 * retries and changes nothing on screen before the server says it's saved.
 */
function useSeasonChange<V>(send: (vars: V) => Promise<unknown>) {
  const refreshAppInit = useRefreshAppInit();
  return useCircleMutation({
    mutationFn: send,
    invalidates: SHOWS_A_SEASON,
    // Home's season banner and letters come with /app-init (until step 5).
    onSuccess: () => void refreshAppInit(),
  });
}

export const useAddSeason = () =>
  useSeasonChange((season: NewSeason) =>
    callApi('/admin/seasons', {
      method: 'post',
      once: true,
      body: { adminUserId: adminUserId(), ...season },
    }),
  );

/** Change a season, its letters, or (with currentSeasonNumber) which season is current. */
export const useUpdateSeason = () =>
  useSeasonChange((change: SeasonChange) =>
    callApi('/admin/seasons', {
      method: 'put',
      once: true,
      body: { adminUserId: adminUserId(), ...change },
    }),
  );

export const useDeleteSeason = () =>
  useSeasonChange((seasonNumber: number) =>
    callApi('/admin/seasons', {
      method: 'delete',
      once: true,
      body: { adminUserId: adminUserId(), seasonNumber },
    }),
  );

/** Upload one photo for a letter; it answers the key to store. Nothing is read again. */
export const useUploadImage = () =>
  useCircleMutation({
    mutationFn: ({ file, folder }: { file: File; folder: string }) =>
      uploadImage(adminUserId(), file, folder),
  });

/** A short-lived link to show a photo uploaded before; none while there is nothing to show. */
export const useMediaUrl = (key: string | undefined) =>
  useCircleQuery({
    key: ['admin', 'media', key ?? null],
    path: '/admin/media/url',
    query: { adminUserId: adminUserId(), key: key ?? '' },
    enabled: !!key,
    select: (answer) => answer.url,
  });
