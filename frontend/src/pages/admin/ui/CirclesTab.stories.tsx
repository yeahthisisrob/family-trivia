import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, within } from 'storybook/test';
import { StoryProviders } from '../../../test/storyContexts';
import { CirclesTab } from './CirclesTab';

const meta: Meta<typeof CirclesTab> = {
  title: 'Admin/CirclesTab',
  component: CirclesTab,
  parameters: {
    layout: 'padded',
    msw: {
      handlers: [
        http.get('*/admin/invites', () =>
          HttpResponse.json({ ok: true, data: { invites: [], joins: [] } }),
        ),
        http.get('*/admin/circles', () =>
          HttpResponse.json({
            ok: true,
            data: {
              owner: true,
              circles: [{ id: 'home', name: 'The Smiths', kind: 'family', root: true }],
            },
          }),
        ),
      ],
    },
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof CirclesTab>;

/** Invites for this circle first; the owner's circles below. */
export const Owner: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Your circles')).toBeInTheDocument();
    await expect(canvas.getByText('The Smiths')).toBeInTheDocument();
  },
};
