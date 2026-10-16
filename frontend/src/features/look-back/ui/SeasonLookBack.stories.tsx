import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { lookBackHandlers } from './lookBackMocks';
import { SeasonLookBack } from './SeasonLookBack';

const meta: Meta<typeof SeasonLookBack> = {
  title: 'Family/SeasonLookBack',
  component: SeasonLookBack,
  args: { onOpenPerson: fn() },
  parameters: { layout: 'padded', msw: { handlers: lookBackHandlers() } },
};
export default meta;
type Story = StoryObj<typeof SeasonLookBack>;

/** The season, the questions most of us answered side by side, what we loved, everyone. */
export const ASeason: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('heading', { name: 'Summer' })).toBeInTheDocument();
    await expect(canvas.getByText(/6 of us · 9 answers · 41 words/)).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { name: 'The questions most of us answered' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('6 reactions · 3 comments', { exact: false }),
    ).toBeInTheDocument();
    await userEvent.click(canvas.getAllByRole('button', { name: /^Bob/ })[0]!);
    await expect(args.onOpenPerson).toHaveBeenCalledWith('bob');
  },
};

/** Every day's question opens a month at a time. */
export const EveryDay: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Read all 3 days' }));
    await expect(await canvas.findByRole('heading', { name: 'July 2025' })).toBeInTheDocument();
  },
};

/** Before any season has started. */
export const NothingYet: Story = {
  parameters: { msw: { handlers: lookBackHandlers(null) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('There’s no season to look back on yet.'),
    ).toBeInTheDocument();
  },
};
