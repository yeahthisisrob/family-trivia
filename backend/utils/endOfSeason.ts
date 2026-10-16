/**
 * End of Season Utilities
 *
 * Thin wrapper around seasonService for backwards compatibility.
 * All season logic now lives in services/seasonService.ts and reads from S3.
 *
 * Callers that previously used the synchronous isEndOfSeason() now need
 * to await it — the function signature has changed to async.
 */

export type {
  Season,
  SeasonStatus,
  SeasonStatusResponse,
  SeasonsConfig,
} from '../services/seasonService';
export {
  getCurrentSeason,
  getLastConcludedSeason,
  getSeasonNumberForData,
  getSeasonStatusResponse,
  isEndOfSeason,
} from '../services/seasonService';
