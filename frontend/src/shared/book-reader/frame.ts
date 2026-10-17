/**
 * Where a book page sits in an image made for sharing: a 4:5 portrait, the
 * size Instagram and most feeds show whole, with the page centred on it and
 * a little room around it, as if laid on a table.
 */
export const SOCIAL = { width: 1080, height: 1350 } as const;

/** Room around the page, as a share of the image's shorter side. */
const ROOM = 0.07;

export function socialFrame(pageWidth: number, pageHeight: number) {
  const room = Math.round(Math.min(SOCIAL.width, SOCIAL.height) * ROOM);
  const scale = Math.min(
    (SOCIAL.width - room * 2) / pageWidth,
    (SOCIAL.height - room * 2) / pageHeight,
  );
  const width = Math.round(pageWidth * scale);
  const height = Math.round(pageHeight * scale);
  return {
    ...SOCIAL,
    scale,
    page: {
      x: Math.round((SOCIAL.width - width) / 2),
      y: Math.round((SOCIAL.height - height) / 2),
      width,
      height,
    },
  };
}

/** A file name for page n of a book: "alice-book-03.png". */
export const pageFileName = (title: string, n: number, of: number) => {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'book';
  return `${slug}-${String(n).padStart(String(of).length, '0')}.png`;
};
