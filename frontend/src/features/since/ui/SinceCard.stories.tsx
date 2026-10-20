import type { Meta, StoryObj } from '@storybook/react-vite';
import { SinceCardView } from './SinceCard';

const names: Record<string, string> = { bob: 'Bob', carol: 'Carol', dee: 'Dee', eli: 'Eli' };
const meta: Meta<typeof SinceCardView> = {
  title: 'Home/SinceCard',
  component: SinceCardView,
  args: {
    nameOf: (id: string) => names[id] ?? id,
    since: {
      since: '2026-10-13T12:00:00.000Z',
      answeredBy: ['bob', 'carol', 'dee', 'eli'],
      comments: 3,
      reactions: 5,
    },
  },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof SinceCardView>;

/** Back after a few days: what's new, not what was missed. */
export const WelcomeBack: Story = {};
