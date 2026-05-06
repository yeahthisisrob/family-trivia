import React from 'react';
import { expect, fn, screen, userEvent, waitFor } from 'storybook/test';

import EditFactDialog, { FactEntryLike } from './EditFactDialog';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof EditFactDialog> = {
  title: 'Admin/EditFactDialog',
  component: EditFactDialog,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Admin dialog for editing a single fact history entry. Shows all fields — question, answer, type, index, date — with an explicit Save button and a change-preview. Replaces the old chip-click-to-swap UX that caused accidental type mutations.',
      },
    },
  },
  args: {
    open: true,
    onClose: fn(),
    onSave: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof EditFactDialog>;

const sharedFact: FactEntryLike = {
  timestamp: '2026-04-05T13:15:00.000Z',
  date: '2026-04-05',
  question: "If you could only keep one favorite possession forever, what would it be and what's its story?",
  answer: "That's a hard one. I have favorite things but all things seem wear down.",
  questionType: 'shared',
};

const basicFact: FactEntryLike = {
  timestamp: '2025-05-16T01:19:16.887Z',
  date: '2025-05-15',
  question: 'When is your birthday? (MM/DD)',
  answer: '01/10',
  questionType: 'basic',
  questionIndex: 0,
};

const skippedFact: FactEntryLike = {
  timestamp: '2026-04-05T13:12:00.000Z',
  date: '2026-04-05',
  question: "What's the scariest movie you remember watching as a kid?",
  answer: '[Skipped]',
  questionType: 'shared',
  skipped: true,
};

const wrongTypedFact: FactEntryLike = {
  timestamp: '2026-04-04T15:00:00.000Z',
  date: '2026-04-04',
  question: "What's your ideal vacation style?",
  answer: 'Exploring small towns surrounded by nature.',
  questionType: 'basic', // WRONG — should be shared
};

export const SharedEntry: Story = {
  args: { fact: sharedFact },
  play: async () => {
    const canvas = screen;
    await expect(canvas.getByText('Edit Fact Entry')).toBeInTheDocument();
    // Save button disabled when no changes
    const save = canvas.getByRole('button', { name: /Save Changes/i });
    await expect(save).toBeDisabled();
  },
};

export const BasicEntryWithIndex: Story = {
  args: { fact: basicFact },
  play: async () => {
    const canvas = screen;
    // Index field visible when type is basic
    await expect(canvas.getByLabelText('Index')).toBeInTheDocument();
  },
};

export const SkippedEntry: Story = {
  args: { fact: skippedFact },
  play: async () => {
    const canvas = screen;
    await expect(canvas.getByText(/marked as skipped/i)).toBeInTheDocument();
  },
};

export const WrongTypedEntry: Story = {
  args: { fact: wrongTypedFact },
  parameters: {
    docs: { description: { story: 'Entry saved with wrong questionType. Change the type dropdown to see the warning banner.' } },
  },
};

export const EditingAnswerEnablesSave: Story = {
  args: { fact: sharedFact },
  play: async ({ args }) => {
    const canvas = screen;
    const save = canvas.getByRole('button', { name: /Save Changes/i });
    await expect(save).toBeDisabled();

    // Type new answer
    const answerField = canvas.getByDisplayValue(sharedFact.answer);
    await userEvent.clear(answerField);
    await userEvent.type(answerField, 'Updated answer text');

    // Save now enabled
    await waitFor(async () => {
      await expect(save).not.toBeDisabled();
    });

    // Pending-changes preview appears
    await expect(canvas.getByText(/Pending changes/i)).toBeInTheDocument();

    await userEvent.click(save);
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ answer: 'Updated answer text' }),
    );
  },
};

export const ChangingTypeShowsWarning: Story = {
  args: { fact: wrongTypedFact },
  play: async () => {
    const canvas = screen;
    // Change type dropdown from basic → shared. MUI Select: click the
    // combobox then pick the option from the listbox (both in document).
    const typeSelect = canvas.getAllByRole('combobox').find(el =>
      el.getAttribute('aria-labelledby')?.includes('Type') ||
      el.closest('[class*="FormControl"]')?.textContent?.includes('Type'),
    ) || canvas.getAllByRole('combobox')[0];
    await userEvent.click(typeSelect);
    const sharedOption = await canvas.findByRole('option', { name: 'shared' });
    await userEvent.click(sharedOption);

    // Warning banner appears
    await waitFor(async () => {
      await expect(canvas.getByText(/Changing type from/i)).toBeInTheDocument();
    });
  },
};

export const InvalidDateBlocksSave: Story = {
  args: { fact: sharedFact },
  play: async ({ args }) => {
    const canvas = screen;
    const dateField = canvas.getByDisplayValue(sharedFact.date);
    await userEvent.clear(dateField);
    await userEvent.type(dateField, 'not-a-date');

    const save = canvas.getByRole('button', { name: /Save Changes/i });
    await userEvent.click(save);

    // Error shows, onSave NOT called
    await waitFor(async () => {
      await expect(canvas.getByText('Date must be YYYY-MM-DD')).toBeInTheDocument();
    });
    await expect(args.onSave).not.toHaveBeenCalled();
  },
};

export const CancelButton: Story = {
  args: { fact: sharedFact },
  play: async ({ args }) => {
    const canvas = screen;
    await userEvent.click(canvas.getByRole('button', { name: /Cancel/i }));
    await expect(args.onClose).toHaveBeenCalled();
  },
};

export const Saving: Story = {
  args: { fact: sharedFact, saving: true },
  play: async () => {
    const canvas = screen;
    await expect(canvas.getByText(/Saving/i)).toBeInTheDocument();
  },
};
