import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { WelcomeCardView } from './WelcomeCard';

const names: Record<string, string> = { bob: 'Bob', carol: 'Carol', dee: 'Dee', eli: 'Eli' };
const meta: Meta<typeof WelcomeCardView> = {
  title: 'Home/WelcomeCard',
  component: WelcomeCardView,
  args: {
    nameOf: (id: string) => names[id] ?? id,
    since: {
      since: '2026-10-13T12:00:00.000Z',
      answeredBy: ['bob', 'carol', 'dee', 'eli'],
      comments: 3,
      reactions: 5,
    },
    trivia: 5,
    questions: 2,
    onPlay: fn(),
  },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof WelcomeCardView>;

/** Back after a week: what's new, and what's waiting. Not what was missed. */
export const BackAfterAWeek: Story = {};

/** An everyday visit: only what's waiting. */
export const JustWaiting: Story = { args: { since: null, trivia: 0, questions: 1 } };
