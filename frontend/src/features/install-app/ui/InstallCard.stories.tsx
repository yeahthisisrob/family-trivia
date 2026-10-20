import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { InstallState } from '../model/install';
import { InstallCardView } from './InstallCard';

const state = (s: Partial<InstallState>): InstallState => ({
  platform: 'ios',
  installed: false,
  inAppBrowser: false,
  canPrompt: false,
  prompt: fn(async () => true),
  ...s,
});

const meta: Meta<typeof InstallCardView> = {
  title: 'Home/InstallCard',
  component: InstallCardView,
  args: { state: state({}), onClose: fn() },
  parameters: { layout: 'padded' },
};
export default meta;
type Story = StoryObj<typeof InstallCardView>;

/** iPhone: Safari's Share sheet, three steps. */
export const IPhone: Story = {};

/** Closed once, it stays closed on this device. */
export const NotNow: Story = {
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await expect(c.getByText('Add to Home Screen')).toBeInTheDocument();
    await userEvent.click(c.getByRole('button', { name: 'Not now' }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};

/** Opened from a link inside another app: Safari first. */
export const IPhoneInAnotherApp: Story = {
  args: { state: state({ inAppBrowser: true }) },
};

/** Android Chrome: the browser installs it with one tap. */
export const OneTap: Story = {
  args: { state: state({ platform: 'android', canPrompt: true }) },
  play: async ({ canvasElement, args }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Add to Home Screen' }));
    await expect(args.state.prompt).toHaveBeenCalled();
  },
};

/** Android without the prompt: the browser menu. */
export const AndroidMenu: Story = {
  args: { state: state({ platform: 'android' }) },
};
