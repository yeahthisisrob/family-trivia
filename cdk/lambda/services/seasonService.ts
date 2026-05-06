/**
 * Season Management Service
 *
 * Reads season configuration from S3 (config/seasons.json).
 * Replaces the old hardcoded endOfSeason.ts config.
 *
 * S3 schema — config/seasons.json:
 * {
 *   "currentSeasonNumber": null | number,
 *   "seasons": [
 *     {
 *       "seasonNumber": 1,
 *       "name": "Season 1",
 *       "status": "concluded",
 *       "startDate": "2025-01-01",
 *       "endDate": "2025-07-24",
 *       "message": "Thank you all for an amazing trivia season! ..."
 *     }
 *   ]
 * }
 *
 * When currentSeasonNumber is null, no season is active → between seasons.
 * When currentSeasonNumber points to a season with status "active", season is live.
 */

import { getJson, listObjects } from './s3';
import { logger } from './logger';
import { S3_PATHS } from '../constants';

// ── Types ────────────────────────────────────────────────────────

export type SeasonStatus = 'active' | 'concluded' | 'upcoming';

export interface Season {
  seasonNumber: number;
  name: string;
  status: SeasonStatus;
  startDate: string;          // YYYY-MM-DD
  endDate: string | null;     // YYYY-MM-DD or null if still active
  message: string | null;     // Message shown to users (e.g. end-of-season thank you)
}

export interface SeasonsConfig {
  currentSeasonNumber: number | null;  // null = between seasons
  seasons: Season[];
}

export interface SeasonStatusResponse {
  isEndOfSeason: boolean;        // true when no active season
  isBetweenSeasons: boolean;     // true when last season concluded, no new one started
  currentSeason: Season | null;  // the active season, if any
  lastSeason: Season | null;     // the most recent concluded season
  personalMessage: string | null;
  seasonEndDate: string | null;
  nextSeasonStart: string | null;
}

// ── In-memory cache (per Lambda invocation cold start) ───────────

let cachedConfig: SeasonsConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute — plenty for Lambda

// ── Public API ───────────────────────────────────────────────────

/**
 * Invalidate the seasons config cache. Call after admin writes.
 */
export function invalidateSeasonsCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

/**
 * Load seasons config from S3, with a short in-memory cache.
 */
export async function getSeasonsConfig(): Promise<SeasonsConfig> {
  const now = Date.now();
  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const config = await getJson<SeasonsConfig>(S3_PATHS.SEASONS_CONFIG);

    if (config && Array.isArray(config.seasons)) {
      cachedConfig = config;
      cacheTimestamp = now;
      return config;
    }
  } catch (err) {
    logger.warn('Failed to load seasons config from S3, using fallback', {
      error: err instanceof Error ? err.message : String(err)
    });
  }

  // Fallback: treat as between seasons (safe default — blocks new content)
  const fallback: SeasonsConfig = {
    currentSeasonNumber: null,
    seasons: []
  };
  cachedConfig = fallback;
  cacheTimestamp = now;
  return fallback;
}

/**
 * Check if there is no active season (replaces the old isEndOfSeason()).
 */
export async function isEndOfSeason(): Promise<boolean> {
  const config = await getSeasonsConfig();
  if (config.currentSeasonNumber === null) return true;

  const current = config.seasons.find(
    s => s.seasonNumber === config.currentSeasonNumber
  );
  return !current || current.status !== 'active';
}

/**
 * Get the currently active season, or null.
 */
export async function getCurrentSeason(): Promise<Season | null> {
  const config = await getSeasonsConfig();
  if (config.currentSeasonNumber === null) return null;

  return config.seasons.find(
    s => s.seasonNumber === config.currentSeasonNumber && s.status === 'active'
  ) || null;
}

/**
 * Get the most recently concluded season.
 */
export async function getLastConcludedSeason(): Promise<Season | null> {
  const config = await getSeasonsConfig();
  const concluded = config.seasons
    .filter(s => s.status === 'concluded')
    .sort((a, b) => b.seasonNumber - a.seasonNumber);

  return concluded[0] || null;
}

/**
 * Compute season date range from answer history (first question → last question).
 * Scans all user answer histories and finds the min/max timestamps.
 * Cached per Lambda invocation.
 */
let cachedDateRange: { startDate: string; endDate: string } | null = null;

async function computeSeasonDatesFromHistory(): Promise<{ startDate: string; endDate: string } | null> {
  if (cachedDateRange) return cachedDateRange;

  try {
    const historyFiles = await listObjects('answers/history/', 100);
    if (historyFiles.length === 0) return null;

    let earliest = '';
    let latest = '';

    for (const key of historyFiles) {
      const history = await getJson<Array<{ timestamp: string }>>(key);
      if (!history || !Array.isArray(history)) continue;

      for (const entry of history) {
        if (!entry.timestamp) continue;
        const dateStr = entry.timestamp.split('T')[0];
        if (!earliest || dateStr < earliest) earliest = dateStr;
        if (!latest || dateStr > latest) latest = dateStr;
      }
    }

    if (earliest && latest) {
      cachedDateRange = { startDate: earliest, endDate: latest };
      return cachedDateRange;
    }
  } catch (err) {
    logger.warn('Failed to compute season dates from history', {
      error: err instanceof Error ? err.message : String(err)
    });
  }
  return null;
}

/**
 * Build the full status response for the frontend.
 * Enriches season dates from actual answer history data.
 */
export async function getSeasonStatusResponse(): Promise<SeasonStatusResponse> {
  const config = await getSeasonsConfig();
  const currentSeason = await getCurrentSeason();
  let lastSeason = await getLastConcludedSeason();

  const ended = !currentSeason;

  // If no seasons config exists but we have answer data, synthesize Season 1
  if (!lastSeason && ended) {
    const dates = await computeSeasonDatesFromHistory();
    if (dates) {
      lastSeason = {
        seasonNumber: 1,
        name: 'Season 1',
        status: 'concluded',
        startDate: dates.startDate,
        endDate: dates.endDate,
        message: "Thank you all for an amazing first season of family trivia! It's been wonderful seeing everyone participate and learn new things about each other.",
      };
    }
  }

  // Enrich concluded season dates from actual history data
  if (lastSeason) {
    const dates = await computeSeasonDatesFromHistory();
    if (dates) {
      lastSeason = { ...lastSeason, startDate: dates.startDate, endDate: dates.endDate };
    }
  }

  const betweenSeasons = ended && lastSeason !== null;

  // Find an upcoming season for "next season start"
  const upcoming = config.seasons.find(s => s.status === 'upcoming');

  return {
    isEndOfSeason: ended,
    isBetweenSeasons: betweenSeasons,
    currentSeason,
    lastSeason,
    personalMessage: ended ? (lastSeason?.message || null) : null,
    seasonEndDate: lastSeason?.endDate || null,
    nextSeasonStart: upcoming?.startDate || null,
  };
}

/**
 * Get the current season number for tagging data (e.g. answer history entries).
 * Returns the active season number, or the last concluded season number as fallback
 * (for catch-up answers submitted after season end).
 */
export async function getSeasonNumberForData(): Promise<number | null> {
  const current = await getCurrentSeason();
  if (current) return current.seasonNumber;

  const last = await getLastConcludedSeason();
  return last?.seasonNumber || null;
}
