import { Button, Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ToastProvider, useToast } from './ToastProvider';

const onView = fn();

const Demo = () => {
  const toast = useToast();
  return (
    <Stack direction="row" spacing={1}>
      <Button
        variant="contained"
        onClick={() =>
          toast({ message: 'Bob commented', action: { label: 'View', onClick: onView } })
        }
      >
        Notification
      </Button>
      <Button onClick={() => toast({ message: 'Invite link copied', tone: 'success' })}>
        Saved
      </Button>
    </Stack>
  );
};

const meta: Meta<typeof Demo> = {
  title: 'Shared/Toast',
  component: Demo,
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  parameters: { layout: 'padded' },
};
export default meta;

/** A new notification while you're in the app: one line, and View opens the bell. */
export const WithAction: StoryObj<typeof Demo> = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Notification' }));
    const body = within(document.body);
    await userEvent.click(await body.findByRole('button', { name: 'View' }));
    await expect(onView).toHaveBeenCalled();
  },
};
