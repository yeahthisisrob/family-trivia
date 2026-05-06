import { fn } from 'storybook/test';

import FamilyFeudTimelineCard from './FamilyFeudTimelineCard';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const entry = {
  userId: 'alice',
  color: '#2196F3',
  initials: 'A',
  question: 'What would Alice pick as her favorite holiday?',
  answer: 'Thanksgiving',
  timestamp: '2026-04-10T14:30:00.000Z',
  feudGuesses: [
    { userName: 'Bob', guess: 'Christmas', correct: false },
    { userName: 'Charlie', guess: 'Thanksgiving', correct: true },
    { userName: 'Dana', guess: 'Fourth of July', correct: false },
  ],
  feudWinners: [{ userId: 'charlie', userName: 'Charlie', points: 5 }],
  feudGuessCount: 3,
  group: 'parents',
};

const meta: Meta<typeof FamilyFeudTimelineCard> = {
  title: 'TimelineBoard/FamilyFeudTimelineCard',
  component: FamilyFeudTimelineCard,
  parameters: { layout: 'padded' },
  args: { entry, onUserClick: fn() },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof FamilyFeudTimelineCard>;

export const Default: Story = {};

export const NoWinners: Story = {
  args: {
    entry: {
      ...entry,
      feudGuesses: entry.feudGuesses.map((g) => ({ ...g, correct: false })),
      feudWinners: [],
    },
  },
};
