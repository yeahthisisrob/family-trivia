import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ROUTES } from '../../hooks/useApp';
import { TriviaTabs } from './TriviaTabs';

const meta: Meta<typeof TriviaTabs> = {
  title: 'AppShell/TriviaTabs',
  component: TriviaTabs,
  args: { onNavigate: fn() },
};
export default meta;
type Story = StoryObj<typeof TriviaTabs>;

export const Play: Story = { args: { currentPath: ROUTES.PLAY } };
export const Leaderboard: Story = { args: { currentPath: ROUTES.LEADERBOARD } };
