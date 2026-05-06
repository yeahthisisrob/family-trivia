import { fn } from 'storybook/test';

import GameModeCard from './GameModeCard';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const baseEntry = {
  userId: 'alice',
  color: '#2196F3',
  initials: 'A',
  question: 'Which planet has the most moons?',
  choices: ['Earth', 'Jupiter', 'Saturn', 'Neptune'],
  answer: 'Saturn',
  selectedAnswer: 'Saturn',
  correct: true,
  timestamp: '2026-04-10T14:30:00.000Z',
  group: 'parents',
};

const meta: Meta<typeof GameModeCard> = {
  title: 'TimelineBoard/GameModeCard',
  component: GameModeCard,
  parameters: { layout: 'padded' },
  args: { mode: 'casino-rush', entries: [baseEntry, baseEntry, baseEntry], userId: 'alice', onUserClick: fn() },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof GameModeCard>;

export const CasinoRushAllCorrect: Story = {};
export const CasinoRushFailed: Story = {
  args: {
    entries: [
      baseEntry,
      { ...baseEntry, selectedAnswer: 'Jupiter', correct: false },
      baseEntry,
    ],
  },
};
export const SlotMachine: Story = {
  args: { mode: 'slot-machine', entries: [baseEntry] },
};
