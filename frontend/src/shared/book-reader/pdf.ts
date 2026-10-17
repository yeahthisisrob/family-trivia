/**
 * A printed book, opened on screen with pdf.js (loaded only when someone
 * opens a book). The press leaves a blank page here and there so the book
 * prints right; on a screen they're skipped.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { IMAGE_WIDTH, imageFrame, inkBands, MAX_GAP, rgb } from './frame';

export interface OpenBook {
  /** The pages worth reading, as pdf.js page numbers (1-based). */
  pages: number[];
  /** Draws a page onto a canvas `width` CSS pixels wide, on paper of `paper`. */
  draw(page: number, canvas: HTMLCanvasElement, width: number, paper: string): Promise<void>;
  /** A page's words as an image, cut down to the lines that hold them. */
  image(page: number, paper: string): Promise<Blob>;
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

  return {
    pages,
    async draw(n, canvas, width, paper) {
      const page = await doc.getPage(n);
      const ratio = window.devicePixelRatio || 1;
      await render(n, canvas, (width / page.getViewport({ scale: 1 }).width) * ratio, paper);
      canvas.style.width = `${width}px`;
    },
    async image(n, paper) {
      const { scale, block, pad } = imageFrame();
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
      const words = bands.reduce((h, [a, b]) => h + b - a + 1, 0);
      const out = document.createElement('canvas');
      out.width = IMAGE_WIDTH;
      out.height = Math.max(1, words + MAX_GAP * Math.max(0, bands.length - 1)) + pad * 2;
      const o = out.getContext('2d');
      if (!o) throw new Error('No canvas');
      o.fillStyle = paper;
      o.fillRect(0, 0, out.width, out.height);
      let y = pad;
      for (const [a, b] of bands) {
        o.drawImage(sheet, x0, a, x1 - x0, b - a + 1, pad, y, x1 - x0, b - a + 1);
        y += b - a + 1 + MAX_GAP;
      }
      return new Promise<Blob>((resolve, reject) =>
        out.toBlob((b) => (b ? resolve(b) : reject(new Error('No image'))), 'image/png'),
      );
    },
    close: () => void task.destroy(),
  };
}
