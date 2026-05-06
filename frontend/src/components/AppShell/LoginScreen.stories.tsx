import { fn } from 'storybook/test';

import LoginScreen from './LoginScreen';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof LoginScreen> = {
  title: 'AppShell/LoginScreen',
  component: LoginScreen,
  parameters: { layout: 'fullscreen' },
  args: {
    googleClientId: 'stub-client-id.apps.googleusercontent.com',
    onActivate: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof LoginScreen>;

export const Default: Story = {};
