/**
 * A book page as an image: only its words. The page's margins, running
 * head and number are left behind, the text block is cut down to the
 * lines that hold ink, and long empty stretches between them close up, so
 * a short page makes a short image.
 */
import { BOOK_PAGE } from '@family-trivia/shared';

export const IMAGE_WIDTH = 1080;
/** Paper around the words, in image pixels. */
const PAD = 64;
/** The most empty paper kept between two lines of words, in image pixels. */
export const MAX_GAP = 72;
/** Room beside the text block for italics and quotes that lean past it, in points. */
const BLEED = 4;

/** The scale that sets the text block across the image, and the block in page points. */
export function imageFrame() {
  const m = BOOK_PAGE.margin;
  const block = {
    x: m.inside - BLEED,
    y: m.top,
    width: BOOK_PAGE.width - m.inside - m.outside + BLEED * 2,
    height: BOOK_PAGE.height - m.top - m.bottom,
  };
  return { scale: (IMAGE_WIDTH - PAD * 2) / block.width, block, pad: PAD };
}

/**
 * The runs of pixel rows, between `rows`, with ink in `cols` (any pixel
 * clearly darker or lighter than the paper). Rows of paper shorter than
 * `gap` stay inside a run; longer stretches split runs, so the image can
 * close them up. Empty for a block with no words.
 */
export function inkBands(
  pixels: Uint8ClampedArray,
  width: number,
  rows: [number, number],
  cols: [number, number],
  paper: [number, number, number],
  gap: number,
): [number, number][] {
  const bands: [number, number][] = [];
  for (let y = rows[0]; y < rows[1]; y++) {
    let ink = false;
    for (let x = cols[0]; x < cols[1] && !ink; x++) {
      const i = (y * width + x) * 4;
      ink =
        Math.abs((pixels[i] ?? 0) - paper[0]) +
          Math.abs((pixels[i + 1] ?? 0) - paper[1]) +
          Math.abs((pixels[i + 2] ?? 0) - paper[2]) >
        48;
    }
    if (!ink) continue;
    const last = bands.at(-1);
    if (last && y - last[1] <= gap) last[1] = y;
    else bands.push([y, y]);
  }
  return bands;
}

/** "#f3ead7" as [243, 234, 215]. */
export const rgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** A file name for page n of a book: "alice-book-03.png". */
export const pageFileName = (title: string, n: number, of: number) => {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'book';
  return `${slug}-${String(n).padStart(String(of).length, '0')}.png`;
};
