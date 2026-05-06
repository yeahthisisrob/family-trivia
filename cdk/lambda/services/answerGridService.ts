/**
 * Answer Grid Service — pure VIEW layer over playerStateService.
 *
 * No independent history loading. Reads pre-computed slots from
 * playerStateService and arranges them into the grid layout:
 *
 *   PAST SEASONS (left-aligned) | ACTIVE SEASON (right-aligned)
 *   [answers...gaps at end]     | [catch-up gaps...answers→today]
 *
 * See docs/answer-grid-rules.md
 */

import { getAllPlayerState, getSeasonSummary, PlayerState } from './playerStateService';
import { QuestionSlot } from './questionSlotService';
import { getEasternDateString } from '@family-trivia/shared';
import { logger } from './logger';

// ── Types ─────────────────────────────────────────────────────────

export interface GridCell { result: boolean | null; isGameMode?: boolean; }
export interface SeasonMarker { column: number; label: string; }

export interface GridRow {
  userId: string;
  cells: GridCell[];
  streak: number;
  answered: number;
  seasonGaps: number;
}

export interface AnswerGridData {
  rows: GridRow[];
  totalColumns: number;
  seasonMarkers: SeasonMarker[];
  seasonStartCol: number;
  todayColumn: number;
}

// ── Helpers ───────────────────────────────────────────────────────

function splitBySeasons(
  slots: QuestionSlot[],
  seasons: { name: string; startDate: string; status: string }[],
): Map<string, QuestionSlot[]> {
  const buckets = new Map<string, QuestionSlot[]>();
  for (const s of slots) {
    const d = s.timestamp.split('T')[0];
    let seasonName = 'unknown';
    for (let i = seasons.length - 1; i >= 0; i--) {
      if (d >= seasons[i].startDate) { seasonName = seasons[i].name; break; }
    }
    if (!buckets.has(seasonName)) buckets.set(seasonName, []);
    buckets.get(seasonName)!.push(s);
  }
  return buckets;
}

// ── Main ──────────────────────────────────────────────────────────

export async function buildAnswerGrid(currentUserId: string): Promise<AnswerGridData> {
  const [allState, summary] = await Promise.all([
    getAllPlayerState(),
    getSeasonSummary(),
  ]);

  const { allSeasons, activeSeason } = summary;
  const pastSeasons = allSeasons.filter(s => s.status !== 'active');

  // Compute max slots per season across ALL players
  const maxPerSeason = new Map<string, number>();
  for (const state of allState.values()) {
    const bySeason = splitBySeasons(state.slots, allSeasons);
    for (const [sn, slots] of bySeason) {
      maxPerSeason.set(sn, Math.max(maxPerSeason.get(sn) ?? 0, slots.length));
    }
  }
  // Ensure today always has a column in the active season.
  // If nobody answered today yet, the max won't include today's slot.
  // Add 1 so the rightmost column represents "today" (empty for everyone).
  if (activeSeason) {
    const todayET = getEasternDateString();
    let anyoneAnsweredToday = false;
    for (const state of allState.values()) {
      if (state.slots.length > 0) {
        const lastDate = state.slots[state.slots.length - 1].timestamp.split('T')[0];
        if (lastDate === todayET) { anyoneAnsweredToday = true; break; }
      }
    }
    const currentMax = maxPerSeason.get(activeSeason.name) ?? 0;
    if (!anyoneAnsweredToday) {
      maxPerSeason.set(activeSeason.name, currentMax + 1);
    }
    if (currentMax === 0 && !anyoneAnsweredToday) {
      maxPerSeason.set(activeSeason.name, 1);
    }
  }

  // Build column layout
  const seasonMarkers: SeasonMarker[] = [];
  let totalColumns = 0;
  const seasonLayout: { name: string; startCol: number; maxSlots: number; isActive: boolean }[] = [];

  for (const ps of pastSeasons) {
    const max = maxPerSeason.get(ps.name) ?? 0;
    if (max === 0) continue;
    seasonMarkers.push({ column: totalColumns, label: ps.name });
    seasonLayout.push({ name: ps.name, startCol: totalColumns, maxSlots: max, isActive: false });
    totalColumns += max;
  }

  let seasonStartCol = totalColumns;
  if (activeSeason) {
    const max = maxPerSeason.get(activeSeason.name) ?? 1;
    seasonMarkers.push({ column: totalColumns, label: activeSeason.name });
    seasonLayout.push({ name: activeSeason.name, startCol: totalColumns, maxSlots: max, isActive: true });
    totalColumns += max;
  }

  const todayColumn = totalColumns - 1;

  // Build rows
  const allRows: GridRow[] = [];
  for (const state of allState.values()) {
    const bySeason = splitBySeasons(state.slots, allSeasons);
    const cells: GridCell[] = [];

    for (const layout of seasonLayout) {
      const playerSlots = bySeason.get(layout.name) ?? [];
      if (layout.isActive) {
        // Right-aligned: gaps on left
        const gap = layout.maxSlots - playerSlots.length;
        for (let i = 0; i < gap; i++) cells.push({ result: null });
        for (const s of playerSlots) cells.push({ result: s.correct, isGameMode: s.isGameMode });
      } else {
        // Left-aligned: gaps on right
        for (const s of playerSlots) cells.push({ result: s.correct, isGameMode: s.isGameMode });
        const gap = layout.maxSlots - playerSlots.length;
        for (let i = 0; i < gap; i++) cells.push({ result: null });
      }
    }

    allRows.push({
      userId: state.userId, cells,
      streak: state.streak,
      answered: state.totalSlots,
      seasonGaps: state.catchupGaps,
    });
  }

  // Filter: hide players with 0 current-season activity (except current user)
  const rows = allRows.filter(row => {
    if (row.userId === currentUserId) return true;
    if (!activeSeason) return row.answered > 0;
    const state = allState.get(row.userId);
    return (state?.seasonSlots ?? 0) > 0;
  });

  // Sort: current user first, then alphabetical
  rows.sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    return a.userId.localeCompare(b.userId);
  });

  logger.info('Answer grid built', {
    players: rows.length, totalColumns,
    seasonMarkers: seasonMarkers.length,
    filteredOut: allRows.length - rows.length,
  });

  return { rows, totalColumns, seasonMarkers, seasonStartCol, todayColumn };
}
