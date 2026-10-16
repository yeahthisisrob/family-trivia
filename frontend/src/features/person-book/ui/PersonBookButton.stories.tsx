import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, userEvent, within } from 'storybook/test';
import { PersonBookButton } from './PersonBookButton';

const ok = (data: unknown) => HttpResponse.json({ ok: true, data });

const meta: Meta<typeof PersonBookButton> = {
  title: 'Family/PersonBookButton',
  component: PersonBookButton,
  args: { personId: 'grace', name: 'Grandma Grace' },
  parameters: {
    layout: 'padded',
    msw: {
      handlers: [
        http.post('*/family/person-book', () =>
          ok({
            url: 'https://example.test/grace.pdf',
            pages: 28,
            madeAt: '2024-04-01T00:00:00Z',
            made: true,
          }),
        ),
        http.get('*/family/person-book/versions', () =>
          ok({
            versions: [
              { madeAt: '2024-04-01T00:00:00Z', pages: 28, url: 'https://example.test/grace.pdf' },
              { madeAt: '2024-03-20T00:00:00Z', pages: 26, url: 'https://example.test/old.pdf' },
            ],
          }),
        ),
      ],
    },
  },
};
export default meta;
type Story = StoryObj<typeof PersonBookButton>;

/** One tap: the book, a download, and every version kept. */
export const MakeTheBook: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Make it a book' }));
    const page = within(document.body);
    await expect(await page.findByText(/Ready: 28 pages/)).toBeInTheDocument();
    await expect(page.getByRole('link', { name: 'Download the PDF' })).toHaveAttribute(
      'href',
      'https://example.test/grace.pdf',
    );
    await expect(page.getByText('Every version, kept')).toBeInTheDocument();
  },
};
