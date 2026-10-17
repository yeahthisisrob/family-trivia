/**
 * A printed book, opened on screen with pdf.js (loaded only when someone
 * opens a book). The press leaves a blank page here and there so the book
 * prints right; on a screen they're skipped.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { IMAGE_WIDTH, imageFrame, inkBands, MAX_GAP, pressScale, rgb } from './frame';

export interface OpenBook {
  /** The pages worth reading, as pdf.js page numbers (1-based). */
  pages: number[];
  /** Draws a page onto a canvas `width` CSS pixels wide, on paper of `paper`. */
  draw(page: number, canvas: HTMLCanvasElement, width: number, paper: string): Promise<void>;
  /**
   * Pages side by side in one image, as an open book shows them: each only
   * its words, cut down to the lines that hold them.
   */
  image(pages: number[], colors: { paper: string; fold: string }): Promise<Blob>;
  close(): void;
}

async function pdfjs() {
  const [lib, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  return lib;
}

export async function openBook(url: string): Promise<OpenBook> {
  const lib = await pdfjs();
  // One plain GET: the bucket's CORS allows no Range header, and a book is small.
  const task = lib.getDocument({ url, disableRange: true, disableStream: true });
  const doc: PDFDocumentProxy = await task.promise;
  // The size the press fitted the book to, so the words can be found on each page.
  const size = pressScale(((await doc.getMetadata()).info as { Keywords?: unknown }).Keywords);
  const pages: number[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const text = await (await doc.getPage(n)).getTextContent();
    if (text.items.some((i) => 'str' in i && i.str.trim())) pages.push(n);
  }

  async function render(n: number, canvas: HTMLCanvasElement, scale: number, paper: string) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport, background: paper }).promise;
  }

  /** One page's words, IMAGE_WIDTH wide, as tall as they need. */
  async function words(n: number, paper: string): Promise<HTMLCanvasElement> {
    const { scale, block, pad } = imageFrame(size);
    const sheet = document.createElement('canvas');
    await render(n, sheet, scale, paper);
    const ctx = sheet.getContext('2d');
    if (!ctx) throw new Error('No canvas');
    const x0 = Math.max(0, Math.floor(block.x * scale));
    const x1 = Math.min(sheet.width, Math.ceil((block.x + block.width) * scale));
    const y0 = Math.floor(block.y * scale);
    const y1 = Math.min(sheet.height, Math.ceil((block.y + block.height) * scale));
    const pixels = ctx.getImageData(0, 0, sheet.width, sheet.height).data;
    const bands = inkBands(pixels, sheet.width, [y0, y1], [x0, x1], rgb(paper), MAX_GAP);
    const tall = bands.reduce((h, [a, b]) => h + b - a + 1, 0);
    const out = document.createElement('canvas');
    out.width = IMAGE_WIDTH;
    out.height = Math.max(1, tall + MAX_GAP * Math.max(0, bands.length - 1)) + pad * 2;
    const o = out.getContext('2d');
    if (!o) throw new Error('No canvas');
    o.fillStyle = paper;
    o.fillRect(0, 0, out.width, out.height);
    let y = pad;
    for (const [a, b] of bands) {
      o.drawImage(sheet, x0, a, x1 - x0, b - a + 1, pad, y, x1 - x0, b - a + 1);
      y += b - a + 1 + MAX_GAP;
    }
    return out;
  }

  return {
    pages,
    async draw(n, canvas, width, paper) {
      const page = await doc.getPage(n);
      const ratio = window.devicePixelRatio || 1;
      await render(n, canvas, (width / page.getViewport({ scale: 1 }).width) * ratio, paper);
      canvas.style.width = `${width}px`;
    },
    async image(ns, { paper, fold }) {
      const columns = await Promise.all(ns.map((n) => words(n, paper)));
      const out = document.createElement('canvas');
      out.width = IMAGE_WIDTH * columns.length;
      out.height = Math.max(...columns.map((c) => c.height));
      const o = out.getContext('2d');
      if (!o) throw new Error('No canvas');
      o.fillStyle = paper;
      o.fillRect(0, 0, out.width, out.height);
      columns.forEach((c, i) => {
        o.drawImage(c, i * IMAGE_WIDTH, 0);
      });
      // The gutter: a faint fold between the two pages.
      for (let i = 1; i < columns.length; i++) {
        o.fillStyle = fold;
        o.fillRect(i * IMAGE_WIDTH - 1, out.height * 0.06, 2, out.height * 0.88);
      }
      return new Promise<Blob>((resolve, reject) =>
        out.toBlob((b) => (b ? resolve(b) : reject(new Error('No image'))), 'image/png'),
      );
    },
    close: () => void task.destroy(),
  };
}
