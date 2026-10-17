import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { BookReader } from './BookReader';

/** A small 6 × 9 book as the press makes one: a title page, a blank, then chapters. */
function tinyBook(pages: string[][]): string {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body);
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(''); // the page tree, filled in below
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>');
  const kids: number[] = [];
  for (const lines of pages) {
    const text = lines
      .map((l, i) => `BT /F1 ${i ? 13 : 24} Tf 60 ${560 - i * 30} Td (${l}) Tj ET`)
      .join('\n');
    add(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 432 648] /Resources << /Font << /F1 3 0 R >> >> /Contents ${objects.length} 0 R >>`,
    );
    kids.push(objects.length);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let out = '%PDF-1.4\n';
  const at: number[] = [];
  objects.forEach((body, i) => {
    at.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of at) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return `data:application/pdf;base64,${btoa(out)}`;
}

const book = tinyBook([
  ['Grandma Grace', '1931 - 2024', 'in her own words'],
  [],
  ['The last things Grace told us', 'What made you smile today?', 'The birds at the feeder'],
  ['2023', 'What is your favorite dessert?', 'Apple pie, warm, with ice cream'],
]);

const meta: Meta<typeof BookReader> = {
  title: 'Shared/BookReader',
  component: BookReader,
  args: { url: book, title: 'Grandma Grace, in her own words', onClose: () => undefined },
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof BookReader>;

/** Pages turn with the arrows; the press's blank page is left out. */
export const Reading: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(page.getByText('1 of 3')).toBeVisible(), { timeout: 10_000 });
    await userEvent.click(page.getByRole('button', { name: 'Next page' }));
    await expect(page.getByText('2 of 3')).toBeVisible();
    await expect(page.getByRole('button', { name: /Download all 3 images \(zip\)/ })).toBeEnabled();
  },
};

/** A link that's gone says so, and points to the download. */
export const WontOpen: Story = {
  args: { url: 'data:application/pdf;base64,bm90IGEgcGRm' },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(page.getByText(/wouldn’t open/)).toBeVisible(), {
      timeout: 10_000,
    });
  },
};
