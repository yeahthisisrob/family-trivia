import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HubIcon from '@mui/icons-material/Hub';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { rememberingHandlers } from '../../remembering/ui/rememberingMocks';
import { FamilyHome } from './FamilyHome';
import { familyHomeHandlers } from './familyHomeMocks';

const meta: Meta<typeof FamilyHome> = {
  title: 'Family/FamilyHome',
  component: FamilyHome,
  args: {
    meId: 'carol',
    onOpenPerson: fn(),
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

/** Tapping someone goes to their profile, where their story is told. */
export const OpensAPerson: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const [face] = await canvas.findAllByRole('button', { name: /Aunt Ivy/ });
    await userEvent.click(face!);
    await expect(args.onOpenPerson).toHaveBeenCalledWith('ivy');
  },
};

/** Someone the family has lost opens on their Remembering page, right here. */
export const OpensSomeoneRemembered: Story = {
  parameters: { msw: { handlers: [...rememberingHandlers(), ...familyHomeHandlers()] } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const [face] = await canvas.findAllByRole('button', { name: /Grandma Grace/ });
    await userEvent.click(face!);
    const page = within(document.body);
    await expect(
      await page.findByRole('heading', { name: 'The last things Grandma Grace told us' }),
    ).toBeInTheDocument();
    await expect(args.onOpenPerson).not.toHaveBeenCalled();
  },
};

export const BeforeTheStoryIsWritten: Story = {
  parameters: { msw: { handlers: familyHomeHandlers(null) } },
};
