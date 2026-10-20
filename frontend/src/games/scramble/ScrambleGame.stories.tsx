import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ScrambleView } from './ScrambleGame';

const clues = [
  { clue: "Bob: What's your favorite food?", answer: 'TACOS', from: 'answers' as const },
  { clue: 'Which planet is the red one?', answer: 'MARS', from: 'trivia' as const },
];

const meta: Meta<typeof ScrambleView> = {
  title: 'Arcade/Scramble',
  component: ScrambleView,
  args: { clues, onClose: fn(), onFinish: fn() },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof ScrambleView>;

export const Ready: Story = {};

/** Spelling the answer moves on to the next clue. */
export const Solving: Story = {
  args: { autoStart: true },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Bob: What's your favorite food?")).toBeInTheDocument();
    for (const l of 'TACOS') {
      const free = c.getAllByRole('button', { name: l }).find((b) => !b.hasAttribute('disabled'));
      if (free) await userEvent.click(free);
    }
    await expect(await c.findByText('Which planet is the red one?')).toBeInTheDocument();
  },
};

/** A circle with too few answers yet. */
export const NotEnough: Story = { args: { clues: [] } };
