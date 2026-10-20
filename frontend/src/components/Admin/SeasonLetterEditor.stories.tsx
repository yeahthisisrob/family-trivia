import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
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

/** The start letter left empty: the welcome everyone gets instead, and a way to start from it. */
export const StartLeftEmpty: Story = {
  args: { season: { seasonNumber: 3, name: 'Summer of Stories', pace: 'weekly', play: 'teams' } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole('tab', { name: 'When it starts' }));
    await expect(
      body.getByText(/Leave it empty and everyone gets the welcome/),
    ).toBeInTheDocument();
    await expect(body.getByText('Summer of Stories begins')).toBeInTheDocument();
    await userEvent.click(body.getByRole('button', { name: 'Start from it' }));
    const letter = body.getByRole('textbox', { name: 'Letter' }) as HTMLTextAreaElement;
    await expect(letter.value).toContain('Welcome back. Summer of Stories starts now.');
  },
};
