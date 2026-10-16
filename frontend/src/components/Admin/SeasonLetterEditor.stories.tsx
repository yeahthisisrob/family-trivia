import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { SeasonLetterEditor } from './SeasonLetterEditor';

const meta: Meta<typeof SeasonLetterEditor> = {
  title: 'Admin/SeasonLetterEditor',
  component: SeasonLetterEditor,
  args: { onClose: fn() },
};
export default meta;
type Story = StoryObj<typeof SeasonLetterEditor>;

export const NewLetters: Story = {
  args: { season: { seasonNumber: 3, name: 'Summer of Stories' } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Summer of Stories has ended')).toBeInTheDocument();
    await expect(body.getByText('Your letter appears here.')).toBeInTheDocument();
  },
};

/** An old plain-text end message is carried into the end letter. */
export const FromOldMessage: Story = {
  args: {
    season: {
      seasonNumber: 1,
      name: 'Season 1',
      message: 'Thank you all for an amazing first season!',
    },
  },
};
