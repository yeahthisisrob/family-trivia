import CasinoRushProgress from './CasinoRushProgress';

import type { ProgressMessage } from '../../api/modules/trivia';
import type { Meta, StoryObj } from '@storybook/react-vite';

const now = Date.now();
const sampleMessages: ProgressMessage[] = [
  { type: 'info', message: 'Spinning up…', timestamp: now },
  { type: 'checking', message: 'Loading questions', timestamp: now + 200 },
  { type: 'success', message: 'Go!', timestamp: now + 500 },
];

const meta: Meta<typeof CasinoRushProgress> = {
  title: 'TriviaCard/CasinoRushProgress',
  component: CasinoRushProgress,
  parameters: { layout: 'padded' },
  args: {
    messages: sampleMessages,
  },
};
export default meta;
type Story = StoryObj<typeof CasinoRushProgress>;

export const Default: Story = {};

export const Compact: Story = {
  args: { compact: true },
};

export const Expanded: Story = {
  args: { compact: false },
};
