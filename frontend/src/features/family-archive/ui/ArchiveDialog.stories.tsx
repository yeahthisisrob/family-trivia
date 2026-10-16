import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ArchiveDialog } from './ArchiveDialog';

const options = (canExport: boolean) =>
  http.get('*/archive/options', () =>
    HttpResponse.json({
      ok: true,
      data: {
        canExport,
        people: [
          { id: 'alice', name: 'Alice', remembered: false },
          { id: 'bob', name: 'Bob', remembered: false },
          { id: 'carol', name: 'Carol', remembered: false },
          { id: 'grace', name: 'Grandma Grace', remembered: true },
        ],
        households: [{ id: 'mom', name: "Mom's house", members: ['alice', 'carol'] }],
      },
    }),
  );

const meta: Meta<typeof ArchiveDialog> = {
  title: 'Family/ArchiveDialog',
  component: ArchiveDialog,
  args: { onClose: fn() },
};
export default meta;
type Story = StoryObj<typeof ArchiveDialog>;

/** Everyone is chosen to start; a household chip toggles its people. */
export const ChooseWho: Story = {
  parameters: { msw: { handlers: [options(true)] } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText('Grandma Grace (in memory)')).toBeInTheDocument();
    await expect(body.getByRole('button', { name: /Download \(4\)/ })).toBeEnabled();
    await userEvent.click(body.getByText("Mom's house"));
    await expect(body.getByRole('button', { name: /Download \(2\)/ })).toBeEnabled();
  },
};

export const NotAllowed: Story = {
  parameters: { msw: { handlers: [options(false)] } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByText(/turned off for you/)).toBeInTheDocument();
  },
};
