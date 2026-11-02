import { type Drop, getTodayET } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { day } from './eventMocks';
import { QuickAddView } from './QuickAdd';

const visit: Drop = {
  id: 'alice-q1',
  by: 'alice',
  kind: 'plan',
  title: "Grandpa's",
  start: day(4),
  time: { start: '16:30' },
  zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  place: "Grandpa's house",
  said: "Thursday 4:30 at Grandpa's",
  createdAt: getTodayET(),
};

const meta: Meta<typeof QuickAddView> = {
  title: 'Events/QuickAdd',
  component: QuickAddView,
  args: { open: true, onClose: fn(), onAdd: fn(async () => [visit]), onDetails: fn() },
};
export default meta;
type Story = StoryObj<typeof QuickAddView>;

/** Type it like you'd text it; it comes back as an event to finish in the editor. */
export const SayIt: Story = {
  play: async ({ canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(await page.findByRole('button', { name: "Thursday 4:30 at Grandpa's" }));
    await userEvent.click(page.getByRole('button', { name: 'Add' }));
    await expect(args.onAdd).toHaveBeenCalledWith("Thursday 4:30 at Grandpa's");
    await userEvent.click(
      await page.findByRole('button', { name: "Add details and who it's for" }),
    );
    await expect(args.onDetails).toHaveBeenCalledWith(visit);
  },
};

/** In dark mode. */
export const SayItDark: Story = { globals: { scheme: 'dark' } };

/** Nothing with a day in it. */
export const NoDay: Story = {
  args: { onAdd: fn(async () => []) },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.type(await page.findByLabelText('What is happening'), 'someday');
    await userEvent.click(page.getByRole('button', { name: 'Add' }));
    await expect(await page.findByText(/couldn't find a day/)).toBeInTheDocument();
  },
};
