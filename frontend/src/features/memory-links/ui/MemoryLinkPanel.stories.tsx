import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { MemoryLinkPanelView } from './MemoryLinkPanel';

const meta: Meta<typeof MemoryLinkPanelView> = {
  title: 'Remembering/MemoryLinkPanel',
  component: MemoryLinkPanelView,
  args: {
    name: 'Sam',
    links: [],
    waiting: [],
    onMake: fn(async () => ({
      token: 't'.repeat(22),
      circleId: 'crew',
      personId: 'sam',
      createdBy: 'alice',
      createdAt: '2026-10-01T00:00:00Z',
      expiresAt: null,
      uses: 0,
    })),
    onRevoke: fn(async () => undefined),
    onDecide: fn(async () => undefined),
  },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof MemoryLinkPanelView>;

/** No link yet: pick how long, make one, share it. */
export const MakeALink: Story = {};

/** A link out, and a memory waiting for a yes. */
export const Waiting: Story = {
  args: {
    links: [
      {
        token: 't'.repeat(22),
        circleId: 'crew',
        personId: 'sam',
        createdBy: 'alice',
        createdAt: '2026-10-01T00:00:00Z',
        expiresAt: null,
        uses: 3,
      },
    ],
    waiting: [
      {
        id: 'm1',
        name: 'Eli',
        how: 'his cousin',
        text: 'The road trip to the lake, singing the whole way.',
        at: '2026-10-02T00:00:00Z',
        status: 'waiting',
      },
    ],
  },
};
