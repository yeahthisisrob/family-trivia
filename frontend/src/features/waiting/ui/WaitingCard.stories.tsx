import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { WaitingCard } from './WaitingCard';

const meta: Meta<typeof WaitingCard> = {
  title: 'Home/WaitingCard',
  component: WaitingCard,
  args: { trivia: 5, questions: 2, onPlay: fn() },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof WaitingCard>;

/** Back after a week away: what's waiting, not what was missed. */
export const BackAfterAWeek: Story = {};

/** Only questions waiting: the card below answers them. */
export const OnlyQuestions: Story = { args: { trivia: 0, questions: 3 } };
