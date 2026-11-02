import type { Rsvp } from '@family-trivia/shared';
import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { AttendanceLine, AttendancePicker } from './Attendance';
import { birthdayView, nameOf } from './eventMocks';

const meta: Meta = { title: 'Events/Attendance', parameters: { layout: 'padded' } };
export default meta;

const Demo = () => {
  const [answer, setAnswer] = useState<Rsvp | null>(null);
  return (
    <Stack spacing={2}>
      <AttendancePicker value={answer} onChange={setAnswer} />
      <AttendanceLine rsvps={birthdayView.rsvps} me="alice" nameOf={nameOf} notes />
    </Stack>
  );
};

/** One tap answers; everyone's answers as their own chips, notes under them. */
export const OneTap: StoryObj = {
  render: () => <Demo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Going/ }));
    await expect(canvas.getByRole('button', { name: /Going/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(canvas.getByRole('button', { name: /Going/ }));
    await expect(canvas.getByRole('button', { name: /Going/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(canvas.getByText(/Bob is going \+2/)).toBeInTheDocument();
  },
};

/** In dark mode. */
export const OneTapDark: StoryObj = { render: () => <Demo />, globals: { scheme: 'dark' } };
