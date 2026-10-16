import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { StoryProviders } from '../../test/storyContexts';
import AppHeader from './AppHeader';

const meta: Meta<typeof AppHeader> = {
  title: 'AppShell/AppHeader',
  component: AppHeader,
  parameters: { layout: 'fullscreen' },
  args: {
    selectedUser: 'alice',
    currentPath: '/',
    onLogout: fn(),
    onNavigate: fn(),
    onAvatarClick: fn(),
    onNotificationClick: fn(),
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
type Story = StoryObj<typeof AppHeader>;

export const Home: Story = {};
export const OnTrivia: Story = { args: { currentPath: '/play' } };
export const OnLeaderboard: Story = { args: { currentPath: '/leaderboard' } };
export const Admin: Story = { args: { isAdmin: true } };
export const Loading: Story = { args: { loading: true } };
