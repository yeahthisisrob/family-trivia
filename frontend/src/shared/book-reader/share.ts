/**
 * Handing images to the phone's share sheet, or, where a browser can't
 * share files, downloading them in one zip.
 */
import { zipSync } from 'fflate';

export async function shareImages(files: File[], title: string): Promise<'shared' | 'saved'> {
  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files, title });
      return 'shared';
    } catch (e) {
      // Closing the share sheet isn't a failure; anything else falls back to saving.
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
    }
  }
  if (files.length === 1 && files[0]) save(files[0], files[0].name);
  else {
    const entries: Record<string, Uint8Array> = {};
    for (const f of files) entries[f.name] = new Uint8Array(await f.arrayBuffer());
    // PNGs are already compressed; storing them is as small and much faster.
    const zip = zipSync(entries, { level: 0 });
    save(new Blob([zip.slice()], { type: 'application/zip' }), `${title}.zip`);
  }
  return 'saved';
}

function save(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
