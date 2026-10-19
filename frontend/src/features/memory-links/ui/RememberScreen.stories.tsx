import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RememberScreenView } from './RememberScreen';

// A made-up friend the crew remembers (never a real one: docs/decisions/0006).
const open = {
  state: 'open' as const,
  person: { name: 'Sam', years: '1985 to 2017', dedication: 'Always the first to laugh.' },
  circle: { name: 'The Crew', kind: 'friends' as const },
  memories: [
    {
      name: 'Dee',
      how: 'we played in a band',
      text: 'He tuned my guitar before every show, every single time, and never said a word about it.',
      at: '2026-10-01T12:00:00Z',
    },
  ],
};

const meta: Meta<typeof RememberScreenView> = {
  title: 'Remembering/RememberScreen',
  component: RememberScreenView,
  args: { preview: open, onAdd: fn(async () => undefined) },
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof RememberScreenView>;

/** What someone with the link sees: who it's for, a place to write, what others shared. */
export const ShareAMemory: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Your name'), 'Eli');
    await userEvent.type(canvas.getByLabelText('Your memory'), 'The road trip to the lake.');
    await userEvent.click(canvas.getByText('Share it'));
    await expect(args.onAdd).toHaveBeenCalledWith({
      name: 'Eli',
      how: undefined,
      text: 'The road trip to the lake.',
    });
    await expect(await canvas.findByText('Thank you.')).toBeInTheDocument();
  },
};

/** A link that was taken back says so, and shows nothing else. */
export const Closed: Story = { args: { preview: { state: 'revoked' } } };

/** The page as it opens. */
export const TheLinkPage: Story = {};
