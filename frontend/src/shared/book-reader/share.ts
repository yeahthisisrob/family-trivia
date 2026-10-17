/**
 * Images out of the app: to the phone's share sheet, or downloaded. A
 * download of more than one image is always one zip.
 */
import { zipSync } from 'fflate';

/** Whether this browser can hand image files to a share sheet. */
export const canShareImages = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.canShare?.({ files: [new File([''], 'a.png', { type: 'image/png' })] });

/** To the share sheet; where there is none, downloaded instead. */
export async function shareImages(files: File[], name: string): Promise<void> {
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title: name });
      return;
    } catch (e) {
      // Closing the share sheet isn't a failure; anything else falls back to saving.
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  await saveImages(files, name);
}

/** Downloaded: one image as itself, more as one zip named `name`.zip. */
export async function saveImages(files: File[], name: string): Promise<void> {
  if (files.length === 1 && files[0]) {
    save(files[0], files[0].name);
    return;
  }
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = new Uint8Array(await f.arrayBuffer());
  // PNGs are already compressed; storing them is as small and much faster.
  const zip = zipSync(entries, { level: 0 });
  save(new Blob([zip.slice()], { type: 'application/zip' }), `${name}.zip`);
}

function save(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
