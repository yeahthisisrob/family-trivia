import { http, HttpResponse } from 'msw';
import React, { useState } from 'react';

import FactAnswerInput from './FactAnswerInput';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';


const API = '/api';

// Stateful wrapper so typing actually works in Storybook
const StatefulInput: React.FC<{ userId: string; placeholder?: string; disabled?: boolean }> = (props) => {
  const [value, setValue] = useState('');
  return (
    <FactAnswerInput
      value={value}
      onChange={setValue}
      onSubmit={() => alert(`Submitted: ${value}`)}
      {...props}
    />
  );
};

const meta: Meta<typeof StatefulInput> = {
  title: 'Home/FactAnswerInput',
  component: StatefulInput,
  parameters: { layout: 'padded' },
  args: { userId: 'alice' },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof StatefulInput>;

const historyWithAnswers = {
  history: [
    { answered: true, skipped: false, answer: 'Pizza with the family' },
    { answered: true, skipped: false, answer: 'Playing in the backyard' },
    { answered: true, skipped: false, answer: 'My grandmother' },
    { answered: true, skipped: false, answer: 'Christmas morning' },
    { answered: true, skipped: false, answer: 'I love cooking together' },
    { answered: true, skipped: false, answer: 'When I was young we lived on a farm' },
  ],
  basicQuestions: [],
  allSharedQuestions: [],
};

export const Default: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/user-fact-history`, () => HttpResponse.json(historyWithAnswers)),
      ],
    },
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/user-fact-history`, () => HttpResponse.json(historyWithAnswers)),
      ],
    },
  },
};
