import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { DailyMemory } from './DailyMemory';

const names: Record<string, string> = {
  carol: 'Carol',
  bob: 'Bob',
  ivy: 'Aunt Ivy',
  jo: 'Jo',
  grace: 'Grandma Grace',
};

const answer = (personId: string, text: string) => ({
  id: `${personId}_2024-10-16T13:00:00.000Z`,
  personId,
  answer: text,
});

const meta: Meta<typeof DailyMemory> = {
  title: 'Home/DailyMemory',
  component: DailyMemory,
  args: {
    me: 'carol',
    nameOf: (id: string) => names[id] ?? id,
    onOpenPerson: fn(),
    memory: {
      date: '2026-10-16',
      asked: '2024-10-16',
      question: 'What’s a small everyday moment that always makes you smile?',
      kind: 'on-this-day',
      answers: [
        answer('grace', 'The birds at the feeder'),
        answer('bob', 'Coffee on the porch before anyone else is up'),
        answer('ivy', 'The kids running in after school'),
        answer('jo', 'A text from Grandma with too many emojis'),
        answer('carol', 'Birds in the garden'),
      ],
    },
  },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof DailyMemory>;

/** Asked on this day two years ago: the first four answers, then the rest. */
export const OnThisDay: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/On this day, 2 years ago/)).toBeInTheDocument();
    await expect(canvas.queryByText('Birds in the garden')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Read all 5 answers' }));
    await expect(canvas.getByText('Birds in the garden')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Grandma Grace' }));
    await expect(args.onOpenPerson).toHaveBeenCalledWith('grace');
  },
};

export const FromOurPages: Story = {
  args: {
    memory: {
      date: '2026-10-17',
      asked: '2025-03-01',
      question: 'Comfort food?',
      kind: 'from-our-pages',
      answers: [answer('bob', 'Mom’s apple pie'), answer('ivy', 'Apple pie')],
    },
  },
};

/** Nothing to bring back yet: nothing shown. */
export const NothingYet: Story = {
  args: { memory: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('region')).toBeNull();
  },
};
