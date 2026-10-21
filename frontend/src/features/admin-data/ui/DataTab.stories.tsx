import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { peopleHandlers } from '../../admin-people/ui/peopleMocks';
import { DataTab } from './DataTab';
import { dataHandlers } from './dataMocks';

const meta: Meta<typeof DataTab> = {
  title: 'Admin/DataTab',
  component: DataTab,
  parameters: {
    layout: 'padded',
    msw: { handlers: [...dataHandlers(), ...peopleHandlers()] },
    docs: {
      description: {
        component:
          'Admin › Player Data: pick someone to see and fix their facts and trivia; Family ' +
          "Feud and the plays left open are the whole circle's. Each change asks first, is " +
          'sent once, and asks again for every screen that shows what it changed.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof DataTab>;

const pick = async (canvasElement: HTMLElement, userId: string) => {
  const canvas = within(canvasElement);
  const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(canvas.getByRole('combobox'));
  await userEvent.click(await body.findByRole('option', { name: userId }));
};

export const NoPlayerChosen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('Select a player to view their data')).toBeInTheDocument();
  },
};

/** Two answers to the same question are marked; the trivia tab counts theirs too. */
export const FactsAndTrivia: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await pick(canvasElement, 'bob');
    await expect(
      await canvas.findByText('Apple, warm, with a slice of cheddar.'),
    ).toBeInTheDocument();
    await expect(canvas.getAllByText('dupe ×2')).toHaveLength(2);
    await expect(canvas.getByText('skipped')).toBeInTheDocument();
    await userEvent.click(await canvas.findByRole('tab', { name: 'Trivia (2)' }));
    await expect(await canvas.findByText('Science & Nature · 10 pts')).toBeInTheDocument();
    await expect(canvas.getByText('Catchup')).toBeInTheDocument();
  },
};

export const NothingYet: Story = {
  parameters: { msw: { handlers: [...dataHandlers({ empty: true }), ...peopleHandlers()] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await pick(canvasElement, 'dana');
    await expect(await canvas.findByText('No facts found for this player')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('tab', { name: 'Sessions' }));
    await expect(await canvas.findByText('No stuck game sessions found')).toBeInTheDocument();
  },
};

/** Family Feud is the whole circle's: no one to pick first. */
export const FamilyFeud: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: 'Feud' }));
    await expect(await canvas.findByText('Current Round')).toBeInTheDocument();
    await expect(canvas.getByText('1 guesses')).toBeInTheDocument();
    await expect(canvas.getByText('Recent Rounds')).toBeInTheDocument();
  },
};

export const OpenPlays: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('tab', { name: 'Sessions' }));
    await expect(await canvas.findByText('charlie')).toBeInTheDocument();
    await expect(canvas.getByText(/2\/5 questions answered/)).toBeInTheDocument();
  },
};

/** Deleting asks first; a refusal from the server shows above the list. */
export const DeleteTurnedDown: Story = {
  parameters: {
    msw: {
      handlers: [
        http.delete('*/admin/user-facts', () =>
          HttpResponse.json({ ok: false, error: 'Fact entry not found' }, { status: 404 }),
        ),
        ...dataHandlers(),
        ...peopleHandlers(),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await pick(canvasElement, 'bob');
    await canvas.findByText('Cherry.');
    await userEvent.click(canvas.getAllByTestId('DeleteIcon')[1] as HTMLElement);
    await expect(await body.findByText(/This removes exactly one entry/)).toBeInTheDocument();
    await userEvent.click(body.getByRole('button', { name: 'Delete' }));
    await expect(await canvas.findByText('Fact entry not found')).toBeInTheDocument();
  },
};
