import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveImages } from '../share';

const png = (name: string) => new File(['x'], name, { type: 'image/png' });

describe('saveImages', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads several images as one zip, even where the browser could share them', async () => {
    const share = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share });
    URL.createObjectURL = vi.fn(() => 'blob:zip');
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    await saveImages([png('a-1.png'), png('a-2.png')], 'alice-in-her-own-words');
    expect(names).toEqual(['alice-in-her-own-words.zip']);
    expect(share).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
