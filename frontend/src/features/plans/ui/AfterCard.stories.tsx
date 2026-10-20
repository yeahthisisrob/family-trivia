import { addDays, getTodayET } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AfterCardView } from './AfterCard';

const names: Record<string, string> = { alice: 'Alice', bob: 'Bob', carol: 'Carol' };
const meta: Meta<typeof AfterCardView> = {
  title: 'Home/AfterCard',
  component: AfterCardView,
  args: {
    me: 'alice',
    nameOf: (id: string) => names[id] ?? id,
    plans: [
      {
        drop: {
          id: 'carol-1',
          by: 'carol',
          kind: 'plan',
          title: 'Hike at the falls',
          start: addDays(getTodayET(), -2),
          createdAt: '',
        },
        who: ['carol', 'alice', 'bob'],
        memories: [{ by: 'bob', text: 'Carol carried the snacks up the whole way.', at: '' }],
      },
    ],
    onRemember: fn(async () => undefined),
    onSkip: fn(async () => undefined),
  },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof AfterCardView>;

/** Two days after the hike: what Bob remembers, and room for yours. */
export const HowWasIt: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByPlaceholderText('What do you want to remember?'), 'The view.');
    await userEvent.click(canvas.getByText('Share'));
    await expect(args.onRemember).toHaveBeenCalledWith('carol-1', 'The view.');
  },
};
