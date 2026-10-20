import type { TeamsView } from '@family-trivia/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TeamsCardView } from './TeamsCard';

const people = ['alice', 'bob', 'carol', 'dave', 'erin'].map((id) => ({
  id,
  name: id[0]?.toUpperCase() + id.slice(1),
}));
const teams: TeamsView = {
  on: true,
  teams: [
    { id: 't1', name: 'Quizzards', members: ['bob', 'carol'], createdAt: '2026-10-01' },
    { id: 't2', name: 'Dave & Erin', members: ['dave', 'erin'], createdAt: '2026-10-02' },
  ],
  myTeam: null,
  toMe: [],
  fromMe: [],
  standings: [
    { teamId: 't2', name: 'Dave & Erin', members: ['dave', 'erin'], average: 140, total: 280 },
    { teamId: 't1', name: 'Quizzards', members: ['bob', 'carol'], average: 95, total: 190 },
  ],
};
const act = {
  start: fn(async () => teams),
  join: fn(async () => teams),
  teamUp: fn(async () => teams),
  answer: fn(async () => teams),
  leave: fn(async () => teams),
};

const meta: Meta<typeof TeamsCardView> = {
  title: 'Home/TeamsCard',
  component: TeamsCardView,
  args: { me: 'alice', people, view: teams, act },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof TeamsCardView>;

/** On your own mid-season: ask to join a team, team up, or start one. */
export const OnYourOwn: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByText('Ask to join Quizzards'));
    await expect(args.act.join).toHaveBeenCalledWith('t1');
  },
};

/** On a team, with someone asking to join. */
export const SomeoneWantsIn: Story = {
  args: {
    me: 'bob',
    view: {
      ...teams,
      myTeam: 't1',
      toMe: [{ id: 'r1', kind: 'join', from: 'alice', teamId: 't1', at: '2026-10-03' }],
    },
  },
};
