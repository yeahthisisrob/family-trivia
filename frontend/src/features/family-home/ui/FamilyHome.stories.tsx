import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HubIcon from '@mui/icons-material/Hub';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { FamilyHome } from './FamilyHome';
import { familyHomeHandlers } from './familyHomeMocks';

const meta: Meta<typeof FamilyHome> = {
  title: 'Family/FamilyHome',
  component: FamilyHome,
  args: {
    meId: 'carol',
    doors: [
      {
        id: 'tree',
        title: 'The family tree',
        caption: 'Every side, every home',
        icon: <AccountTreeIcon />,
        render: () => 'The tree',
      },
      {
        id: 'connections',
        title: 'How we’re connected',
        caption: 'Ties, and who answers alike',
        icon: <HubIcon />,
        render: () => 'The graph',
      },
    ],
  },
  parameters: { layout: 'padded', msw: { handlers: familyHomeHandlers() } },
};
export default meta;
type Story = StoryObj<typeof FamilyHome>;

export const StoryFirst: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('The Example Family')).toBeInTheDocument();
    await expect(await canvas.findByText('Everyone')).toBeInTheDocument();
    await expect(canvas.getByText('In memory of')).toBeInTheDocument();
  },
};

export const OpensAPerson: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [face] = await canvas.findAllByRole('button', { name: /Aunt Ivy/ });
    await userEvent.click(face!);
    const page = within(document.body);
    await expect(await page.findByRole('tab', { name: 'You & them' })).toBeInTheDocument();
  },
};

export const BeforeTheStoryIsWritten: Story = {
  parameters: { msw: { handlers: familyHomeHandlers(null) } },
};
