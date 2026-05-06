/**
 * End of Season Utilities
 *
 * Thin wrapper around seasonService for backwards compatibility.
 * All season logic now lives in services/seasonService.ts and reads from S3.
 *
 * Callers that previously used the synchronous isEndOfSeason() now need
 * to await it — the function signature has changed to async.
 */

export {
  isEndOfSeason,
  getCurrentSeason,
  getLastConcludedSeason,
  getSeasonStatusResponse,
  getSeasonNumberForData,
} from '../services/seasonService';

export type {
  Season,
  SeasonStatus,
  SeasonsConfig,
  SeasonStatusResponse,
} from '../services/seasonService';
