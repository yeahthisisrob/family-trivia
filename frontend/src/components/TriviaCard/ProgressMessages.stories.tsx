import ProgressMessages from './ProgressMessages';

import type { ProgressMessage } from '../../api/modules/trivia';
import type { Meta, StoryObj } from '@storybook/react-vite';

const now = Date.now();
const sampleMessages: ProgressMessage[] = [
  { type: 'info', message: 'Generating your question…', detail: 'Picking a fresh one from the bank', timestamp: now },
  { type: 'checking', message: 'Checking for duplicates…', timestamp: now + 500 },
  { type: 'success', message: 'Ready!', timestamp: now + 1000 },
];

const meta: Meta<typeof ProgressMessages> = {
  title: 'TriviaCard/ProgressMessages',
  component: ProgressMessages,
  parameters: { layout: 'padded' },
  args: {
    messages: sampleMessages,
    isGenerating: true,
  },
};
export default meta;
type Story = StoryObj<typeof ProgressMessages>;

export const Generating: Story = {};

export const Completed: Story = {
  args: { isGenerating: false },
};

export const WithWarning: Story = {
  args: {
    messages: [
      { type: 'info', message: 'Starting generation', timestamp: now },
      { type: 'warning', message: 'Previous question was similar, retrying…', timestamp: now + 500 },
      { type: 'success', message: 'New question ready', timestamp: now + 1500 },
    ],
  },
};
