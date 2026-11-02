import { Button, TextField } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { Field, Sheet } from './Sheet';

const meta: Meta<typeof Sheet> = {
  title: 'Design System/Sheet',
  component: Sheet,
  args: { open: true, onClose: fn(), title: 'New event' },
};
export default meta;

/** Full screen on a phone, a dialog on a wider screen; the actions stay put. */
export const WithAField: StoryObj<typeof Sheet> = {
  args: {
    children: (
      <Field label="Where" hint="Optional">
        <TextField fullWidth size="small" placeholder="Springfield Park" />
      </Field>
    ),
    actions: (
      <Button variant="contained" sx={{ ml: 'auto' }}>
        Save
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText('Where')).toBeInTheDocument();
  },
};
