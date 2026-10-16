import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SeasonLetter } from './SeasonLetter';

const meta: Meta<typeof SeasonLetter> = {
  title: 'Seasons/SeasonLetter',
  component: SeasonLetter,
  args: { onClose: fn(), seasonName: 'Spring Time' },
};
export default meta;
type Story = StoryObj<typeof SeasonLetter>;

export const SeasonEnded: Story = {
  args: {
    letter: {
      seasonNumber: 2,
      kind: 'end',
      markdown: `Thank you, everyone, for playing this spring.

Every morning there was something new to talk about: Grace's garden, Bob's terrible puns, the great pizza debate.

> Assume everyone is trying their best, and be kind to each other.

See you next season.`,
    },
  },
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Spring Time has ended')).toBeInTheDocument();
    await userEvent.click(body.getByRole('button', { name: 'Close' }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const SeasonBegins: Story = {
  args: {
    seasonName: 'Summer of Stories',
    letter: {
      seasonNumber: 3,
      kind: 'start',
      markdown: `## Welcome back!\n\nThis season is all about **family**: every question comes from the stories you share.`,
    },
  },
};

export const WithPhoto: Story = {
  args: {
    letter: {
      seasonNumber: 2,
      kind: 'end',
      imageUrl:
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="620" height="400"><rect width="100%" height="100%" fill="%23d8c9a8"/><circle cx="310" cy="190" r="90" fill="%23b9a27a"/></svg>',
      markdown: 'For the mornings we shared.',
    },
  },
};

/** A letter that remembers someone: its own title instead of "has ended". */
export const InMemory: Story = {
  args: {
    letter: {
      seasonNumber: 2,
      kind: 'end',
      title: 'In memory of…',
      markdown: `## Grace Example\n*1940 to 2025*\n\n> She loved every bird that came to the garden.\n\n**What always makes you smile?**\n*The birds at the feeder.*`,
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('In memory of…')).toBeInTheDocument();
  },
};
