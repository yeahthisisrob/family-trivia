/**
 * A printed book, opened on screen with pdf.js (loaded only when someone
 * opens a book). The press leaves a blank page here and there so the book
 * prints right; on a screen they're skipped.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { socialFrame } from './frame';

export interface OpenBook {
  /** The pages worth reading, as pdf.js page numbers (1-based). */
  pages: number[];
  /** Draws a page onto a canvas `width` CSS pixels wide, on paper of `paper`. */
  draw(page: number, canvas: HTMLCanvasElement, width: number, paper: string): Promise<void>;
  /** A page as a 4:5 image for sharing. */
  image(page: number, colors: { paper: string; table: string; shadow: string }): Promise<Blob>;
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
  const task = lib.getDocument({ url });
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
    async image(n, colors) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const frame = socialFrame(base.width, base.height);
      const sheet = document.createElement('canvas');
      await render(n, sheet, frame.scale, colors.paper);
      const out = document.createElement('canvas');
      out.width = frame.width;
      out.height = frame.height;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('No canvas');
      ctx.fillStyle = colors.table;
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.shadowColor = colors.shadow;
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 10;
      ctx.drawImage(sheet, frame.page.x, frame.page.y, frame.page.width, frame.page.height);
      return new Promise<Blob>((resolve, reject) =>
        out.toBlob((b) => (b ? resolve(b) : reject(new Error('No image'))), 'image/png'),
      );
    },
    close: () => void task.destroy(),
  };
}
