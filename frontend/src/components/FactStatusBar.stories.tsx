import { http, HttpResponse } from 'msw';

import FactStatusBar from './FactStatusBar';

import type { Meta, StoryObj } from '@storybook/react-vite';

const API = '/api';

const sampleGrid = {
  rows: [
    { userId: 'alice', cells: [{ result: true }, { result: true }, { result: false }, { result: true }], answered: 3, seasonGaps: 1 },
    { userId: 'bob', cells: [{ result: true }, { result: null }, { result: true }, { result: false }], answered: 2, seasonGaps: 1 },
    { userId: 'charlie', cells: [{ result: false }, { result: true }, { result: true }, { result: true }], answered: 3, seasonGaps: 0 },
  ],
  totalColumns: 4,
  seasonMarkers: [{ column: 0, label: 'Spring Season' }],
  seasonStartCol: 0,
  todayColumn: 3,
};

const meta: Meta<typeof FactStatusBar> = {
  title: 'FactStatusBar/FactStatusBar',
  component: FactStatusBar,
  parameters: {
    layout: 'padded',
    msw: {
      handlers: [
        http.get(`${API}/fact-grid`, () => HttpResponse.json(sampleGrid)),
      ],
    },
  },
  args: { userId: 'alice' },
};
export default meta;
type Story = StoryObj<typeof FactStatusBar>;

export const Default: Story = {};

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/fact-grid`, () => HttpResponse.json({
          rows: [], totalColumns: 0, seasonMarkers: [], seasonStartCol: 0, todayColumn: 0,
        })),
      ],
    },
  },
};
