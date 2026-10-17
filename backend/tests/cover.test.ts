import { bookCover, spineWidth } from '../services/press/cover';

const base = {
  title: 'Winter',
  family: 'The Example Family',
  subtitle: 'in our own words',
  dates: 'January 2024',
  blurb: 'We kept coming back to the beach.',
  numbers: '3 of us · 9 answers',
};

test('the spine is as thick as the book, never thinner than 24 pages', () => {
  expect(spineWidth(200)).toBeCloseTo(200 * 0.0025 * 72);
  expect(spineWidth(4)).toBe(spineWidth(24));
});

test('one wraparound page: back, spine and front, with bleed', async () => {
  const pdf = await bookCover({ ...base, pages: 120 });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  const box = pdf.toString('latin1').match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  const [w, h] = [Number(box?.[1]), Number(box?.[2])];
  expect(w).toBeCloseTo(0.125 * 72 * 2 + 6 * 72 * 2 + spineWidth(120), 0);
  expect(h).toBeCloseTo(0.125 * 72 * 2 + 9 * 72, 0);
});

test('a photo that won’t open leaves the cover plain, not broken', async () => {
  const pdf = await bookCover({ ...base, pages: 40, photo: new Uint8Array([1, 2, 3]) });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
});

test('page numbers never add pages: a short book is only as long as its pages', async () => {
  const { press } = await import('../services/press/press');
  const p = press({ title: 'T', author: 'F' });
  p.page(); // the title page
  p.chapter('One'); // page 2
  p.chapter('Two'); // begins lower on page 2: most of it is still empty
  const { pages } = await p.finish();
  expect(pages).toBe(2);
});

test('a book set smaller or larger still prints on a 6 × 9 page', async () => {
  const { press } = await import('../services/press/press');
  const p = press({ title: 'T', author: 'F', scale: 0.9 });
  p.chapter('One');
  p.paragraphs('Words. '.repeat(400), 12);
  const { pdf, scale } = await p.finish();
  expect(scale).toBe(0.9);
  const boxes = pdf.toString('latin1').match(/\/MediaBox \[[^\]]*\]/g) ?? [];
  expect(boxes.length).toBeGreaterThan(1);
  for (const b of boxes) expect(b).toBe('/MediaBox [0 0 432 648]');
});

test('fitted keeps the size with the fewest near-empty pages, then no blank last page', async () => {
  const { fitted } = await import('../services/press/press');
  const tried: number[] = [];
  const laid = (scale: number, sparse: number, padded: boolean) => ({
    pdf: Buffer.alloc(0),
    pages: 10,
    scale,
    sparse,
    padded,
  });
  const got = await fitted(async (scale) => {
    tried.push(scale);
    if (scale === 1) return laid(scale, 2, false);
    if (scale === 0.94) return laid(scale, 1, true);
    if (scale === 1.06) return laid(scale, 1, false);
    return laid(scale, 3, false);
  });
  expect(got.scale).toBe(1.06); // as few near-empty pages as 0.94, and no blank
  expect(tried).toEqual([1, 0.94, 1.06, 0.89, 1.12]);
  // A perfect fit stops the search.
  tried.length = 0;
  await fitted(async (scale) => {
    tried.push(scale);
    return laid(scale, 0, false);
  });
  expect(tried).toEqual([1]);
});

test('emoji print from the emoji font instead of as empty boxes', async () => {
  const { emojiRuns, press } = await import('../services/press/press');
  expect(emojiRuns('Pay all debts ❤️')).toEqual([
    { text: 'Pay all debts ', emoji: false },
    { text: '❤', emoji: true },
  ]);
  // A shrug with a skin tone and a joined ♀ is drawn as the shrug alone.
  expect(emojiRuns('🤷🏼‍♀️ lol')).toEqual([
    { text: '🤷', emoji: true },
    { text: ' lol', emoji: false },
  ]);
  expect(emojiRuns('© 2026')).toEqual([{ text: '© 2026', emoji: false }]);
  const p = press({ title: 'T', author: 'F' });
  p.chapter('One');
  p.paragraphs('So good 😂 and ❤️', 12);
  const { pdf } = await p.finish();
  expect(pdf.includes('NotoEmoji')).toBe(true);
});
