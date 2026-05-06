import React from 'react';
import { expect, fn, within } from 'storybook/test';

import CategorySelect from './CategorySelect';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof CategorySelect> = {
  title: 'Trivia/Selection/CategorySelect',
  component: CategorySelect,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Unified trivia selection card. One card with: optional catch-up banner, Special Challenges (game mode carousel with desktop arrows), and category grid. Game tiles stay exactly as-is inside the unified wrapper.',
      },
    },
  },
  args: {
    onSelect: fn(),
    recentSelections: [],
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <div style={{ maxWidth: 420 }}><Story /></div>
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof CategorySelect>;

// ── Stories ──────────────────────────────────────────────────────────

/** Default: fresh user, no history, all game modes available */
export const FreshUser: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('What do you want to play?')).toBeInTheDocument();
    await expect(canvas.getByText('Special Challenges')).toBeInTheDocument();
    await expect(canvas.getByText('Pick a Category')).toBeInTheDocument();
    await expect(canvas.getByText('History & Politics')).toBeInTheDocument();
  },
};

/** Catching up — banner at top shows count */
export const CatchingUp: Story = {
  args: { isCatchingUp: true, catchupBehind: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Catching up — 3 questions remaining/)).toBeInTheDocument();
    // Game modes still available during catch-up
    await expect(canvas.getByText('Special Challenges')).toBeInTheDocument();
  },
};

/** Catching up with 1 question left */
export const CatchUpLastOne: Story = {
  args: { isCatchingUp: true, catchupBehind: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/1 question remaining/)).toBeInTheDocument();
  },
};

/** User has pick history — shows "You: N" badges and lock states */
export const WithPickHistory: Story = {
  args: {
    recentSelections: [
      { category: 'History & Politics', timestamp: new Date().toISOString() },
      { category: 'History & Politics', timestamp: new Date(Date.now() - 86400000).toISOString() },
      { category: 'Science & Nature', timestamp: new Date().toISOString() },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('You: 2')).toBeInTheDocument();
    await expect(canvas.getByText('You: 1')).toBeInTheDocument();
  },
};

/** View-only: done for the day — countdown chip, all tiles locked */
export const ViewOnly: Story = {
  args: { viewOnly: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Your Categories')).toBeInTheDocument();
    await expect(canvas.getByText('Categories')).toBeInTheDocument();
    // All game modes locked (no "Play now")
    await expect(canvas.queryByText('Play now')).not.toBeInTheDocument();
    await expect(canvas.getByText('Casino Rush')).toBeInTheDocument();
  },
};

/** All game modes on cooldown but user can still pick categories */
export const GameModesLocked: Story = {
  decorators: [
    (Story) => (
      <StoryProviders trivia={{ canPlayCasinoRush: false, canPlaySlotMachine: false, canPlayCurling: false }}>
        <div style={{ maxWidth: 420 }}><Story /></div>
      </StoryProviders>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Play now')).not.toBeInTheDocument();
    // Categories still clickable
    await expect(canvas.getByText('Pick a Category')).toBeInTheDocument();
  },
};

/** All game modes available — shows "Play now" on tiles */
export const GameModesAvailable: Story = {
  decorators: [
    (Story) => (
      <StoryProviders trivia={{ canPlayCasinoRush: true, canPlaySlotMachine: true, canPlayCurling: true }}>
        <div style={{ maxWidth: 420 }}><Story /></div>
      </StoryProviders>
    ),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const playButtons = canvas.getAllByText('Play now');
    await expect(playButtons.length).toBeGreaterThan(0);
  },
};
