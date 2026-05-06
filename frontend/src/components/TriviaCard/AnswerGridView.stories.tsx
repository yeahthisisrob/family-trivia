import React from 'react';
import { expect, within } from 'storybook/test';

import AnswerGridView, { AnswerGridData, GridCell } from './AnswerGridView';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof AnswerGridView> = {
  title: 'Trivia/Cards/AnswerGridView',
  component: AnswerGridView,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Answer grid showing per-player question history across seasons. Cells are color-coded (green/red for correct/wrong), with amber outline for game-mode entries (Casino Rush, Slot Machine). Current-season cells are numbered above; today\'s column is highlighted in primary green.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof AnswerGridView>;

// Helpers
const cell = (result: boolean | null, isGameMode = false): GridCell => ({ result, isGameMode });

const gapCells = (n: number): GridCell[] => Array.from({ length: n }, () => cell(null));
const rightCells = (results: (boolean | 'game')[]): GridCell[] =>
  results.map(r => r === 'game' ? cell(true, true) : cell(r));

function buildGrid(opts: {
  sStart: number;
  rows: Array<{ userId: string; sessionResults: (boolean | 'game' | null)[]; seasonGaps?: number }>;
  seasonLabel?: string;
}): AnswerGridData {
  const { sStart, rows, seasonLabel = 'Season 1' } = opts;
  const maxLen = Math.max(...rows.map(r => r.sessionResults.length));
  const total = sStart + maxLen;
  const todayColumn = total - 1;

  const gridRows = rows.map(r => {
    const activeCells: GridCell[] = [];
    // right-align: gaps on left to equalize lengths
    const gap = maxLen - r.sessionResults.length;
    for (let i = 0; i < gap; i++) activeCells.push(cell(null));
    for (const res of r.sessionResults) {
      if (res === 'game') activeCells.push(cell(true, true));
      else if (res === null) activeCells.push(cell(null));
      else activeCells.push(cell(res));
    }
    const pastSeason = gapCells(sStart);
    const cells = [...pastSeason, ...activeCells];
    return {
      userId: r.userId,
      cells,
      streak: 0,
      answered: activeCells.filter(c => c.result !== null).length,
      seasonGaps: r.seasonGaps ?? 0,
    };
  });

  return {
    rows: gridRows,
    totalColumns: total,
    seasonMarkers: sStart > 0
      ? [{ column: 0, label: 'S0' }, { column: sStart, label: seasonLabel }]
      : [{ column: 0, label: seasonLabel }],
    seasonStartCol: sStart,
    todayColumn,
  };
}

export const Default: Story = {
  args: {
    userId: 'alice',
    grid: buildGrid({
      sStart: 0,
      rows: [
        { userId: 'alice', sessionResults: [true, true, false, true, true, true, 'game', true, null] },
        { userId: 'bob',   sessionResults: [true, false, true, true, false, true, true, true, null] },
        { userId: 'carol', sessionResults: [true, true, true, 'game', true, false, true, false, null] },
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Season label and legend entries
    await expect(canvas.getByText('Correct')).toBeInTheDocument();
    await expect(canvas.getByText('Game mode')).toBeInTheDocument();
    // Sample number label
    await expect(canvas.getByText('1')).toBeInTheDocument();
  },
};

export const WithCatchupGaps: Story = {
  args: {
    userId: 'alice',
    grid: buildGrid({
      sStart: 0,
      rows: [
        { userId: 'alice', sessionResults: [null, null, null, true, true, false, true, 'game', null], seasonGaps: 3 },
        { userId: 'bob',   sessionResults: [true, true, true, true, true, true, true, true, null] },
      ],
    }),
  },
  parameters: {
    docs: { description: { story: 'User has catch-up gaps — pulsing gray cells on the left of the active season.' } },
  },
};

export const GameModeHeavy: Story = {
  args: {
    userId: 'alice',
    grid: buildGrid({
      sStart: 0,
      rows: [
        { userId: 'alice', sessionResults: ['game', true, 'game', true, 'game', true, null] },
        { userId: 'bob',   sessionResults: [true, 'game', true, 'game', true, 'game', null] },
      ],
    }),
  },
  parameters: {
    docs: { description: { story: 'Shows the amber outline treatment on game-mode cells (Casino Rush / Slot Machine).' } },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Game mode')).toBeInTheDocument();
  },
};

export const MultipleSeasons: Story = {
  args: {
    userId: 'alice',
    grid: buildGrid({
      sStart: 8,
      rows: [
        { userId: 'alice', sessionResults: [true, true, true, false, 'game', true, null] },
        { userId: 'bob',   sessionResults: [true, true, true, true, true, true, null] },
      ],
      seasonLabel: 'Season 2',
    }),
  },
  parameters: {
    docs: { description: { story: 'Past season cells on the left (left-aligned), current season on the right.' } },
  },
};

export const ShortSeason: Story = {
  args: {
    userId: 'alice',
    grid: buildGrid({
      sStart: 0,
      rows: [
        { userId: 'alice', sessionResults: [true, 'game', null] },
        { userId: 'bob',   sessionResults: [true, true, null] },
      ],
    }),
  },
};

export const TodayHighlighted: Story = {
  args: {
    userId: 'alice',
    grid: buildGrid({
      sStart: 0,
      rows: [
        { userId: 'alice', sessionResults: [true, true, true, true, true, true, true, true, true] },
        { userId: 'bob',   sessionResults: [true, true, true, true, true, true, true, true, true] },
      ],
    }),
  },
  parameters: {
    docs: { description: { story: 'Today\'s column number is highlighted in primary green.' } },
  },
};

export const NoLegend: Story = {
  args: {
    userId: 'alice',
    showLegend: false,
    grid: buildGrid({
      sStart: 0,
      rows: [
        { userId: 'alice', sessionResults: [true, true, false, 'game', null] },
      ],
    }),
  },
};
