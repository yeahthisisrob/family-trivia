/**
 * A book's cover, as a print-on-demand press takes it: one wraparound PDF,
 * back, spine and front, with an eighth of an inch of bleed on every side.
 * The spine is as thick as the book (Amazon KDP's cream paper, 0.0025 inch a
 * page), and carries the title only once it's wide enough to hold it. The
 * lower right of the back is left clear for the press's barcode.
 *
 *   back: the blurb and the numbers   spine: title · family   front: family,
 *   title, "in our own words", a framed photo when there is one, the dates
 */
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { curly, TRIM } from './press';

const INCH = 72;
const BLEED = 0.125 * INCH;
/** Kept clear of the trim, where a press may cut. */
const SAFE = 0.5 * INCH;
/** Cream paper, per page. */
const PAGE_THICKNESS = 0.0025 * INCH;
/** A spine narrower than this holds no type (KDP: 79 pages). */
const SPINE_TEXT_MIN = 0.2 * INCH;

const CLOTH = '#1f2738';
const CREAM = '#f3ead7';
const GOLD = '#d6b469';

const FONTS = process.env.BOOK_FONTS_DIR ?? path.join(__dirname, 'fonts');
const font = (f: string) => path.join(FONTS, `EBGaramond-${f}.ttf`);

export interface CoverInput {
  title: string;
  /** Over the title: the family's name. */
  family: string;
  /** Under the title. */
  subtitle: string;
  /** At the foot of the front: the dates, or someone's years. */
  dates?: string | null;
  /** A paragraph or two for the back. */
  blurb: string;
  /** A line under the blurb: the numbers. */
  numbers?: string | null;
  /** JPEG or PNG bytes for the front. */
  photo?: Uint8Array | null;
  pages: number;
}

export const spineWidth = (pages: number) => Math.max(24, pages) * PAGE_THICKNESS;

export function bookCover(c: CoverInput): Promise<Buffer> {
  const spine = spineWidth(c.pages);
  const width = BLEED * 2 + TRIM.width * 2 + spine;
  const height = BLEED * 2 + TRIM.height;
  const doc = new PDFDocument({
    size: [width, height],
    margin: 0,
    font: font('Regular'),
    info: { Title: `${c.title}, cover`, Author: c.family, Creator: 'Family Trivia' },
  });
  doc.registerFont('body', font('Regular'));
  doc.registerFont('italic', font('Italic'));
  doc.registerFont('bold', font('SemiBold'));
  const chunks: Buffer[] = [];
  doc.on('data', (b: Buffer) => chunks.push(b));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks))),
  );

  doc.rect(0, 0, width, height).fill(CLOTH);

  const backX = BLEED;
  const spineX = BLEED + TRIM.width;
  const frontX = spineX + spine;
  const top = BLEED;
  const inner = TRIM.width - SAFE * 2;

  // ── Front ──────────────────────────────────────────────────────────
  const fx = frontX + SAFE;
  let y = top + TRIM.height * 0.11;
  doc
    .font('body')
    .fontSize(11)
    .fillColor(GOLD)
    .text(c.family, fx, y, {
      width: inner,
      align: 'center',
      features: ['smcp'],
      characterSpacing: 2,
    });
  y = doc.y + 14;
  doc
    .font('body')
    .fontSize(c.title.length > 18 ? 34 : 42)
    .fillColor(CREAM);
  doc.text(curly(c.title), fx, y, { width: inner, align: 'center' });
  y = doc.y + 10;
  doc
    .moveTo(frontX + TRIM.width / 2 - 28, y)
    .lineTo(frontX + TRIM.width / 2 + 28, y)
    .lineWidth(0.7)
    .strokeColor(GOLD)
    .stroke();
  y += 14;
  doc
    .font('italic')
    .fontSize(14)
    .fillColor(CREAM)
    .text(c.subtitle, fx, y, { width: inner, align: 'center' });
  y = doc.y + 26;

  if (c.photo) {
    const maxW = TRIM.width * 0.58;
    const maxH = top + TRIM.height - SAFE - 60 - y;
    try {
      // pdfkit has openImage; its types don't. The size frames the photo before it's drawn.
      const img = (
        doc as unknown as { openImage(src: Buffer): { width: number; height: number } }
      ).openImage(Buffer.from(c.photo));
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = frontX + (TRIM.width - w) / 2;
      doc
        .rect(x - 6, y - 6, w + 12, h + 12)
        .lineWidth(0.8)
        .strokeColor(GOLD)
        .stroke();
      doc.image(img as unknown as Buffer, x, y, { width: w, height: h });
    } catch {
      // A photo that won't open just leaves the cover plain.
    }
  }

  if (c.dates)
    doc
      .font('body')
      .fontSize(11)
      .fillColor(GOLD)
      .text(c.dates, fx, top + TRIM.height - SAFE - 14, {
        width: inner,
        align: 'center',
        features: ['smcp'],
        characterSpacing: 1.5,
      });

  // ── Spine ──────────────────────────────────────────────────────────
  if (spine >= SPINE_TEXT_MIN) {
    const size = Math.min(13, spine * 0.5);
    doc.save();
    // Read top to bottom, as books on a shelf are in English.
    doc.rotate(90, { origin: [spineX + spine / 2, top + TRIM.height / 2] });
    const len = TRIM.height - SAFE * 2;
    doc
      .font('body')
      .fontSize(size)
      .fillColor(CREAM)
      .text(
        `${curly(c.title)}   ·   ${c.family}`,
        spineX + spine / 2 - len / 2,
        top + TRIM.height / 2 - size * 0.62,
        {
          width: len,
          align: 'center',
          lineBreak: false,
        },
      );
    doc.restore();
  }

  // ── Back ───────────────────────────────────────────────────────────
  const bx = backX + SAFE;
  doc
    .font('body')
    .fontSize(12)
    .fillColor(CREAM)
    .text(curly(c.blurb), bx, top + TRIM.height * 0.16, {
      width: inner,
      align: 'justify',
      lineGap: 3,
      height: TRIM.height * 0.5,
      ellipsis: '…',
    });
  if (c.numbers)
    doc
      .font('italic')
      .fontSize(11)
      .fillColor(GOLD)
      .text(c.numbers, bx, doc.y + 18, { width: inner, align: 'left' });
  // The lower right of the back stays clear: the press prints its barcode there.

  doc.end();
  return done;
}
