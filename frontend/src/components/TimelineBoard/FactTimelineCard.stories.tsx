import { fn } from 'storybook/test';

import FactTimelineCard from './FactTimelineCard';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const entry = {
  userId: 'alice',
  color: '#2196F3',
  initials: 'A',
  question: "What's your favorite family tradition?",
  answer: 'Sunday brunch — we all cook together',
  fact: 'Family rituals like shared meals are shown to strengthen bonds across generations.',
  timestamp: '2026-04-10T14:30:00.000Z',
  group: 'parents',
};

const meta: Meta<typeof FactTimelineCard> = {
  title: 'TimelineBoard/FactTimelineCard',
  component: FactTimelineCard,
  parameters: { layout: 'padded' },
  args: { entry, onUserClick: fn() },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof FactTimelineCard>;

export const Default: Story = {};

export const NoFact: Story = {
  args: { entry: { ...entry, fact: undefined } },
};

export const Skipped: Story = {
  args: { entry: { ...entry, skipped: true, answer: '[Skipped]', fact: undefined } },
};

export const Custom: Story = {
  args: { entry: { ...entry, isCustomFact: true } },
};
