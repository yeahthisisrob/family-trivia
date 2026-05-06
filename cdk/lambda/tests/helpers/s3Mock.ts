/**
 * In-memory S3 mock for integration tests.
 *
 * Usage:
 *   jest.mock('../../services/s3', () => require('../helpers/s3Mock').s3MockModule);
 *
 * Then use setup/teardown helpers:
 *   resetS3Mock()         — clear all state
 *   seedHistory(user, [e]) — seed a user's history file
 *   seedSeasons(config)   — seed seasons config
 *   seedRaw(key, value)   — set any S3 object
 *   getStored<T>(key)     — read any S3 object
 *   getHistory(user)      — read a user's history
 */
import type { HistoryEntry } from '@family-trivia/shared';
import type { SeasonsConfig } from '../../services/seasonService';

const store = new Map<string, unknown>();

export function resetS3Mock(): void {
  store.clear();
}

export function seedRaw(key: string, value: unknown): void {
  store.set(key, value);
}

export function getStored<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function seedHistory(userId: string, entries: HistoryEntry[]): void {
  store.set(`answers/history/${userId}.json`, entries);
}

export function getHistory(userId: string): HistoryEntry[] {
  return (store.get(`answers/history/${userId}.json`) as HistoryEntry[]) ?? [];
}

export function seedSeasons(config: SeasonsConfig): void {
  store.set('config/seasons.json', config);
}

/** Active season covering today, running since 30 days ago */
export function seedDefaultActiveSeason(): void {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const iso = (d: Date) => d.toISOString().split('T')[0];
  seedSeasons({
    currentSeasonNumber: 1,
    seasons: [
      {
        seasonNumber: 1,
        name: 'Season 1',
        status: 'active',
        startDate: iso(thirtyDaysAgo),
        endDate: null,
        message: null,
      },
    ],
  });
}

/** Concluded season → isEndOfSeason = true */
export function seedEndedSeason(): void {
  seedSeasons({
    currentSeasonNumber: null,
    seasons: [
      {
        seasonNumber: 1,
        name: 'Season 1',
        status: 'concluded',
        startDate: '2025-01-01',
        endDate: '2025-07-24',
        message: 'Season over',
      },
    ],
  });
}

// ── Mock functions that match services/s3 signatures ─────────────────

async function getJson<T>(key: string): Promise<T | null> {
  const v = store.get(key);
  return v === undefined ? null : (v as T);
}

async function putJson(key: string, data: unknown): Promise<void> {
  // Deep-clone to simulate round-trip serialization
  store.set(key, JSON.parse(JSON.stringify(data)));
}

async function listObjects(prefix: string, _maxKeys = 1000): Promise<string[]> {
  const keys: string[] = [];
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) keys.push(k);
  }
  return keys;
}

async function deleteObject(key: string): Promise<void> {
  store.delete(key);
}

async function fileExists(key: string): Promise<boolean> {
  return store.has(key);
}

async function putJsonIfNotExists(key: string, data: unknown): Promise<boolean> {
  if (store.has(key)) return false;
  await putJson(key, data);
  return true;
}

export const s3MockModule = {
  getJson,
  putJson,
  listObjects,
  deleteObject,
  fileExists,
  putJsonIfNotExists,
};
