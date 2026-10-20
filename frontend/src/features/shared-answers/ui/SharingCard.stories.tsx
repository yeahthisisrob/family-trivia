import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { SharedFrom } from '../api/sharingApi';
import { SharingCardView } from './SharingCard';

const both: SharedFrom[] = [
  { circleId: 'home', name: 'The Smiths', kind: 'family', shared: true },
  { circleId: 'crew', name: 'The Crew', kind: 'friends', shared: false },
];

/** The card with working switches, as on Home. */
const Live: React.FC<{ from: SharedFrom[]; failed?: boolean; onDone: () => void }> = (p) => {
  const [from, setFrom] = useState(p.from);
  return (
    <SharingCardView
      from={from}
      failed={p.failed}
      onDone={p.onDone}
      onChange={(id, on) =>
        setFrom((l) => l.map((f) => (f.circleId === id ? { ...f, shared: on } : f)))
      }
    />
  );
};

const meta: Meta<typeof Live> = {
  title: 'Features/Circles/SharingCard',
  component: Live,
  args: { from: both, onDone: fn() },
};
export default meta;
type Story = StoryObj<typeof Live>;

/** In both circles: family answers show, friends ones wait for a yes. */
export const InTwoCircles: Story = {};

/** Turning one on, then done. */
export const Choosing: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    const family = c.getByRole('switch', { name: /The Smiths/ });
    const friends = c.getByRole('switch', { name: /The Crew/ });
    await expect(family).toBeChecked();
    await expect(friends).not.toBeChecked();
    await userEvent.click(friends);
    await expect(friends).toBeChecked();
    await userEvent.click(c.getByRole('button', { name: 'Done' }));
    await expect(args.onDone).toHaveBeenCalled();
  },
};

/** Someone from one of the circles only. */
export const FromOneCircle: Story = { args: { from: [both[1] as SharedFrom] } };

export const DidNotSave: Story = { args: { failed: true } };
