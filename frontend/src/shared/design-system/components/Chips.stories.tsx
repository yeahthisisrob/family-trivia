import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { Stack } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { ChipRow, ChoiceChip, PersonChip } from './Chips';

const meta: Meta = { title: 'Design System/Chips', parameters: { layout: 'padded' } };
export default meta;

/** Choices in a row; an answer takes its tone when chosen. */
export const Choices: StoryObj = {
  render: () => {
    const Demo = () => {
      const [on, setOn] = useState<string | null>('going');
      return (
        <Stack spacing={2}>
          <ChipRow label="Your answer">
            <ChoiceChip tone="good" on={on === 'going'} onClick={() => setOn('going')}>
              <CheckRoundedIcon /> Going
            </ChoiceChip>
            <ChoiceChip tone="watch" on={on === 'maybe'} onClick={() => setOn('maybe')}>
              <HelpOutlineRoundedIcon /> Maybe
            </ChoiceChip>
            <ChoiceChip tone="bad" on={on === 'out'} onClick={() => setOn('out')}>
              <CloseRoundedIcon /> Can't
            </ChoiceChip>
          </ChipRow>
          <ChipRow label="Days">
            {['Mon', 'Tue', 'Wed'].map((d) => (
              <ChoiceChip key={d} dense on={d === 'Tue'}>
                {d}
              </ChoiceChip>
            ))}
          </ChipRow>
        </Stack>
      );
    };
    return <Demo />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Maybe/ }));
    await expect(canvas.getByRole('button', { name: /Maybe/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  },
};

/** People to choose, each in their own color. */
export const People: StoryObj = {
  render: () => (
    <ChipRow label="Who it's for">
      <PersonChip id="alice" name="Alice" on />
      <PersonChip id="bob" name="Bob" />
      <PersonChip id="carol" name="Carol" on />
    </ChipRow>
  ),
};
