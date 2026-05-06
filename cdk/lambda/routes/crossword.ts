// File: lambda/routes/crossword.ts
// Purpose: Generate crossword puzzles from family facts.
// Uses an algorithmic grid builder for dense intersections,
// not AI (LLMs are bad at spatial constraint satisfaction).

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse, getModelForService } from '../config';
import { logger } from '../services/logger';
import { getAllFactHistories } from '../services/factHistoryService';
import { getCurrentSeason } from '../services/seasonService';
import { getJson } from '../services/s3';
import { S3_PATHS } from '../constants';
import { invokeBedrockPrompt } from '../services/bedrock/core/bedrockClient';
import { collectResponseBody, extractJsonFromResponse } from '../services/bedrock/core/responseParser';

interface CrosswordClue {
  number: number;
  clue: string;
  answer: string;
  row: number;
  col: number;
  direction: 'across' | 'down';
}

interface Placement {
  answer: string;
  clue: string;
  row: number;
  col: number;
  direction: 'across' | 'down';
}

// ── Algorithmic Crossword Builder ─────────────────────────────────

/**
 * Build a crossword grid by placing words one at a time,
 * maximizing intersections with already-placed words.
 */
function buildCrossword(
  words: Array<{ answer: string; clue: string }>,
  maxSize = 15,
): { grid: string[][]; placements: Placement[]; size: number } | null {
  // Sort longest first — they're easier to intersect with
  const sorted = [...words].sort((a, b) => b.answer.length - a.answer.length);

  const placements: Placement[] = [];
  const grid: string[][] = Array.from({ length: maxSize }, () => Array(maxSize).fill('.'));

  // Place first word horizontally in the center
  const first = sorted[0];
  const startRow = Math.floor(maxSize / 2);
  const startCol = Math.floor((maxSize - first.answer.length) / 2);
  placeWord(grid, first.answer, startRow, startCol, 'across');
  placements.push({ ...first, row: startRow, col: startCol, direction: 'across' });

  // Try to place remaining words
  for (let w = 1; w < sorted.length; w++) {
    const word = sorted[w];
    const best = findBestPlacement(grid, word.answer, placements, maxSize);
    if (best) {
      placeWord(grid, word.answer, best.row, best.col, best.direction);
      placements.push({ ...word, row: best.row, col: best.col, direction: best.direction });
    }
  }

  if (placements.length < 2) return null; // Need at least 2 intersecting words

  // Trim grid to fit content
  const { trimmed, size, rowOffset, colOffset } = trimGrid(grid);

  // Adjust placements for trimming
  const adjusted = placements.map(p => ({
    ...p,
    row: p.row - rowOffset,
    col: p.col - colOffset,
  }));

  return { grid: trimmed, placements: adjusted, size };
}

function placeWord(grid: string[][], word: string, row: number, col: number, dir: 'across' | 'down') {
  for (let i = 0; i < word.length; i++) {
    if (dir === 'across') grid[row][col + i] = word[i];
    else grid[row + i][col] = word[i];
  }
}

function findBestPlacement(
  grid: string[][],
  word: string,
  existing: Placement[],
  maxSize: number,
): { row: number; col: number; direction: 'across' | 'down'; intersections: number } | null {
  let best: { row: number; col: number; direction: 'across' | 'down'; intersections: number } | null = null;

  for (const dir of ['across', 'down'] as const) {
    for (let r = 0; r < maxSize; r++) {
      for (let c = 0; c < maxSize; c++) {
        // Check if word fits
        const endR = dir === 'down' ? r + word.length - 1 : r;
        const endC = dir === 'across' ? c + word.length - 1 : c;
        if (endR >= maxSize || endC >= maxSize) continue;

        // Check cell before word is empty (no adjacent word in same direction)
        if (dir === 'across' && c > 0 && grid[r][c - 1] !== '.') continue;
        if (dir === 'down' && r > 0 && grid[r - 1][c] !== '.') continue;
        // Check cell after word is empty
        if (dir === 'across' && endC + 1 < maxSize && grid[r][endC + 1] !== '.') continue;
        if (dir === 'down' && endR + 1 < maxSize && grid[endR + 1][c] !== '.') continue;

        let intersections = 0;
        let valid = true;

        for (let i = 0; i < word.length; i++) {
          const cr = dir === 'down' ? r + i : r;
          const cc = dir === 'across' ? c + i : c;
          const cell = grid[cr][cc];

          if (cell !== '.') {
            // Cell already has a letter — must match
            if (cell !== word[i]) { valid = false; break; }
            intersections++;
          } else {
            // Empty cell — check perpendicular neighbors aren't creating invalid adjacency
            if (dir === 'across') {
              if (cr > 0 && grid[cr - 1][cc] !== '.' && !isPartOfExistingWord(existing, cr - 1, cc, cr, cc)) { valid = false; break; }
              if (cr + 1 < maxSize && grid[cr + 1][cc] !== '.' && !isPartOfExistingWord(existing, cr + 1, cc, cr, cc)) { valid = false; break; }
            } else {
              if (cc > 0 && grid[cr][cc - 1] !== '.' && !isPartOfExistingWord(existing, cr, cc - 1, cr, cc)) { valid = false; break; }
              if (cc + 1 < maxSize && grid[cr][cc + 1] !== '.' && !isPartOfExistingWord(existing, cr, cc + 1, cr, cc)) { valid = false; break; }
            }
          }
        }

        if (!valid || intersections === 0) continue; // Must intersect at least once

        if (!best || intersections > best.intersections) {
          best = { row: r, col: c, direction: dir, intersections };
        }
      }
    }
  }

  return best;
}

function isPartOfExistingWord(
  placements: Placement[],
  adjRow: number, adjCol: number,
  curRow: number, curCol: number,
): boolean {
  // Check if the adjacent cell and current cell are part of the same existing word
  for (const p of placements) {
    for (let i = 0; i < p.answer.length; i++) {
      const pr = p.direction === 'down' ? p.row + i : p.row;
      const pc = p.direction === 'across' ? p.col + i : p.col;
      if (pr === adjRow && pc === adjCol) {
        // Adjacent cell is part of this word — check if current cell is too
        for (let j = 0; j < p.answer.length; j++) {
          const pr2 = p.direction === 'down' ? p.row + j : p.row;
          const pc2 = p.direction === 'across' ? p.col + j : p.col;
          if (pr2 === curRow && pc2 === curCol) return true;
        }
      }
    }
  }
  return false;
}

function trimGrid(grid: string[][]): { trimmed: string[][]; size: number; rowOffset: number; colOffset: number } {
  let minR = grid.length, maxR = 0, minC = grid[0].length, maxC = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== '.') {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
  }
  // Add 1 cell padding
  minR = Math.max(0, minR - 1);
  minC = Math.max(0, minC - 1);
  maxR = Math.min(grid.length - 1, maxR + 1);
  maxC = Math.min(grid[0].length - 1, maxC + 1);

  const size = Math.max(maxR - minR + 1, maxC - minC + 1);
  const trimmed: string[][] = [];
  for (let r = minR; r < minR + size; r++) {
    const row: string[] = [];
    for (let c = minC; c < minC + size; c++) {
      row.push(r < grid.length && c < grid[0].length ? grid[r][c] : '.');
    }
    trimmed.push(row);
  }
  return { trimmed, size, rowOffset: minR, colOffset: minC };
}

// ── Endpoint ──────────────────────────────────────────────────────

/**
 * POST /crossword/generate — generate a crossword from family facts.
 *
 * Step 1: Load personal facts from all family members
 * Step 2: Send to Bedrock to extract short crossword answers with personalized clues
 * Step 3: Build grid algorithmically from those pairs
 */
export async function generateCrossword(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    // Load facts + user names + current season
    const [histories, hierarchy, season] = await Promise.all([
      getAllFactHistories(),
      getJson<any>(S3_PATHS.FAMILY_HIERARCHY),
      getCurrentSeason(),
    ]);

    const people = hierarchy?.family?.people || {};
    const seasonStart = season?.startDate;
    const seasonEnd = season?.endDate;

    // Collect facts from current season only
    const rawFacts: Array<{ name: string; question: string; answer: string }> = [];
    for (const [userId, entries] of histories) {
      const name = people[userId]?.name || userId;
      for (const entry of entries) {
        if (!entry.answered || entry.skipped || !entry.answer || !entry.question) continue;
        // Filter to current season
        const date = entry.date || entry.timestamp?.split('T')[0];
        if (seasonStart && date && date < seasonStart) continue;
        if (seasonEnd && date && date > seasonEnd) continue;
        rawFacts.push({ name, question: entry.question, answer: entry.answer });
      }
    }

    if (rawFacts.length < 5) {
      return errorResponse('Not enough family facts for a crossword', 400);
    }

    // Pick 15 random facts — Bedrock extracts ~5-7 usable short-answer pairs
    const shuffled = rawFacts.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(15, shuffled.length));

    // Step 2: Ask Bedrock to extract crossword-ready pairs
    const prompt = `You are creating a small, fun crossword puzzle from family trivia facts. Extract SHORT crossword answers with personalized clues.

FAMILY FACTS:
${selected.map((f, i) => `${i + 1}. ${f.name} was asked "${f.question}" and answered: "${f.answer}"`).join('\n')}

RULES:
- Extract a single keyword from each answer (the most important/obvious word)
- The clue MUST include the person's name (e.g., "Rob's favorite color")
- Answer must be ONE WORD, 3-8 uppercase letters (keep it short and easy!)
- Prefer common, easy-to-spell words
- Rate each clue's difficulty: "easy" (obvious from the clue), "medium" (need to think), "hard" (tricky)
- Return exactly 5 pairs — pick the best/most fun ones

Return ONLY valid JSON:
{
  "pairs": [
    {"clue": "Rob's favorite color", "answer": "BLUE", "difficulty": "easy"},
    {"clue": "Blair's dream city", "answer": "PARIS", "difficulty": "medium"},
    {"clue": "What Betty bakes best", "answer": "PIE", "difficulty": "easy"}
  ]
}`;

    const model = getModelForService('QUESTION_GENERATION');
    const stream = await invokeBedrockPrompt(prompt, 1024, 0.4, { task: 'crossword-clues' }, model);
    const buf = await collectResponseBody(stream);
    const parsed = extractJsonFromResponse(buf, model);

    if (!parsed.pairs || !Array.isArray(parsed.pairs) || parsed.pairs.length < 3) {
      logger.error('Bedrock returned insufficient crossword pairs', { parsed });
      return errorResponse('Could not generate enough crossword clues', 500);
    }

    // Clean and validate pairs
    const cleanPairs: Array<{ answer: string; clue: string; difficulty?: string }> = [];
    const seenAnswers = new Set<string>();
    for (const pair of parsed.pairs) {
      const answer = String(pair.answer || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (answer.length >= 3 && answer.length <= 8 && pair.clue && !seenAnswers.has(answer)) {
        seenAnswers.add(answer);
        cleanPairs.push({ answer, clue: pair.clue, difficulty: pair.difficulty || 'medium' });
      }
    }

    if (cleanPairs.length < 3) {
      return errorResponse('Not enough valid crossword answers generated', 500);
    }

    // Step 3: Build grid algorithmically (max 5-7 words for a quick fun puzzle)
    const result = buildCrossword(cleanPairs.slice(0, 7), 12);
    if (!result) {
      return errorResponse('Could not build a valid crossword grid', 500);
    }

    // Number the clues
    const numbered: CrosswordClue[] = [];
    const numberedPositions = new Map<string, number>();
    let clueNum = 1;

    const sortedPlacements = [...result.placements].sort((a, b) =>
      a.row !== b.row ? a.row - b.row : a.col - b.col,
    );

    for (const p of sortedPlacements) {
      const key = `${p.row},${p.col}`;
      let num = numberedPositions.get(key);
      if (!num) {
        num = clueNum++;
        numberedPositions.set(key, num);
      }
      numbered.push({
        number: num,
        clue: p.clue,
        answer: p.answer,
        row: p.row,
        col: p.col,
        direction: p.direction,
      });
    }

    logger.info('Crossword generated', {
      size: result.size,
      wordsPlaced: result.placements.length,
      pairsFromBedrock: cleanPairs.length,
      acrossCount: numbered.filter(c => c.direction === 'across').length,
      downCount: numbered.filter(c => c.direction === 'down').length,
    });

    // Compute difficulty multiplier from clue ratings
    const difficultyMap: Record<string, number> = { easy: 1, medium: 1.5, hard: 2 };
    const avgDifficulty = cleanPairs.reduce((sum, p) =>
      sum + (difficultyMap[p.difficulty || 'medium'] || 1.5), 0) / cleanPairs.length;

    return successResponse({
      grid: result.grid,
      clues: numbered,
      size: result.size,
      difficultyMultiplier: Math.round(avgDifficulty * 10) / 10,
      totalCells: numbered.reduce((sum, c) => sum + c.answer.length, 0),
    });
  } catch (err: any) {
    logger.error('Crossword generation failed', { error: err.message, stack: err.stack });
    return errorResponse('Failed to generate crossword', 500);
  }
}
