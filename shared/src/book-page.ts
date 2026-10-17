/**
 * A printed book's page, in points (72 to the inch): 6 × 9 inches, and the
 * margins that frame its text block. The press sets pages to it; the app
 * crops page images to the text block.
 */
const INCH = 72;
export const BOOK_PAGE = {
  width: 6 * INCH,
  height: 9 * INCH,
  margin: { top: 0.85 * INCH, bottom: 0.9 * INCH, inside: 0.8 * INCH, outside: 0.8 * INCH },
} as const;
