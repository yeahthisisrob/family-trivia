/**
 * Fact Grid Service
 *
 * Same pattern as answerGridService but for daily facts.
 * Columns = dates where a global shared question exists.
 * Per-player: answered (blue), skipped (grey), or gap (purple pulse).
 *
 * Reads from:
 *   - facts/daily/shared/*.json  → column definitions (question dates)
 *   - facts/answers/{userId}.json → per-user answer history (new consolidated model)
 *
 * Season-split: past seasons left-aligned, active season right-aligned.
 */

import { getJson, listObjects } from './s3';
import { getSeasonsConfig } from './seasonService';
import { S3_PATHS } from '../constants';
import { logger } from './logger';
import { FactAnswerEntry } from '@family-trivia/shared';

// ── Types (same shape as answer grid for frontend reuse) ──────────

export interface FactGridCell {
  /** true = answered, false = skipped, null = not answered (gap) */
  result: boolean | null;
}

export interface FactGridRow {
  userId: string;
  cells: FactGridCell[];
  answered: number;
  seasonGaps: number;
}

export interface FactGridData {
  rows: FactGridRow[];
  totalColumns: number;
  seasonMarkers: { column: number; label: string }[];
  seasonStartCol: number;
  todayColumn: number;
}

// ── Main ──────────────────────────────────────────────────────────

export async function buildFactGrid(currentUserId: string): Promise<FactGridData> {
  // 1. Load all global shared question dates (these define the columns)
  const sharedKeys = await listObjects(S3_PATHS.SHARED_QUESTIONS_DIR);
  const questionDates: string[] = [];
  for (const key of sharedKeys) {
    const match = key.match(/(\d{4}-\d{2}-\d{2})\.json$/);
    if (match) questionDates.push(match[1]);
  }
  questionDates.sort();

  // 2. Load all user fact histories
  const historyKeys = await listObjects('facts/answers/');
  const userData: { userId: string; byDate: Map<string, boolean> }[] = [];

  await Promise.all(
    historyKeys.map(async (key) => {
      const match = key.match(/facts\/answers\/(.+)\.json$/);
      if (!match) return;
      const userId = match[1];

      try {
        const entries = (await getJson<FactAnswerEntry[]>(key)) || [];
        // Map date → answered (true) or skipped (false)
        const byDate = new Map<string, boolean>();
        for (const e of entries) {
          if (e.questionType !== 'shared') continue;
          // answered=true → true, skipped=true → false
          byDate.set(e.date, e.answered && !e.skipped);
        }
        userData.push({ userId, byDate });
      } catch (err) {
        logger.warn('Failed to load fact history', {
          userId, error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );

  // 3. Load seasons
  const seasonsConfig = await getSeasonsConfig();
  const seasons = seasonsConfig.seasons
    .filter(s => s.startDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const activeSeason = seasons.find(s => s.status === 'active');
  const pastSeasons = seasons.filter(s => s.status !== 'active');

  // 4. Split question dates into seasons
  const datesBySeason = new Map<string, string[]>();
  for (const d of questionDates) {
    let seasonName = 'unknown';
    for (let i = seasons.length - 1; i >= 0; i--) {
      if (d >= seasons[i].startDate) { seasonName = seasons[i].name; break; }
    }
    if (!datesBySeason.has(seasonName)) datesBySeason.set(seasonName, []);
    datesBySeason.get(seasonName)!.push(d);
  }

  // 5. Build column layout: past seasons left-aligned, active right-aligned
  const seasonMarkers: { column: number; label: string }[] = [];
  const columnDates: string[] = [];
  let seasonStartCol = 0;

  for (const ps of pastSeasons) {
    const dates = datesBySeason.get(ps.name) ?? [];
    if (dates.length === 0) continue;
    seasonMarkers.push({ column: columnDates.length, label: ps.name });
    columnDates.push(...dates);
  }

  if (activeSeason) {
    seasonStartCol = columnDates.length;
    const activeDates = datesBySeason.get(activeSeason.name) ?? [];
    seasonMarkers.push({ column: columnDates.length, label: activeSeason.name });
    // Active season dates are already in order — just append (right-aligned = no padding needed since these are date-based columns)
    columnDates.push(...activeDates);
  }

  const totalColumns = columnDates.length;
  const todayColumn = totalColumns - 1;

  // 6. Build rows
  const allRows: FactGridRow[] = userData.map(({ userId, byDate }) => {
    const cells: FactGridCell[] = columnDates.map(d => {
      const val = byDate.get(d);
      if (val === true) return { result: true };   // answered
      if (val === false) return { result: false };  // skipped
      return { result: null };                      // gap
    });

    const answered = [...byDate.values()].filter(v => v === true).length;

    // Season gaps = null cells in active season section
    let seasonGaps = 0;
    for (let i = seasonStartCol; i < totalColumns; i++) {
      if (cells[i].result === null) seasonGaps++;
    }

    return { userId, cells, answered, seasonGaps };
  });

  // 7. Filter: hide players with 0 current-season activity (except current user)
  const rows = allRows.filter(row => {
    if (row.userId === currentUserId) return true;
    if (!activeSeason) return row.answered > 0;
    const activeDates = datesBySeason.get(activeSeason.name) ?? [];
    const user = userData.find(u => u.userId === row.userId);
    return activeDates.some(d => user?.byDate.has(d));
  });

  // Sort: current user first, then alphabetical
  rows.sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    return a.userId.localeCompare(b.userId);
  });

  logger.info('Fact grid built', {
    players: rows.length, totalColumns,
    seasonMarkers: seasonMarkers.length,
    filteredOut: allRows.length - rows.length,
  });

  return { rows, totalColumns, seasonMarkers, seasonStartCol, todayColumn };
}
