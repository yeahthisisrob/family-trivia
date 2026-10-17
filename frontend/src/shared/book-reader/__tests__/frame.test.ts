import { BOOK_PAGE } from '@family-trivia/shared';
import { describe, expect, it } from 'vitest';
import { IMAGE_WIDTH, imageFrame, inkBands, pageFileName, rgb } from '../frame';

describe('imageFrame', () => {
  it('sets the text block, not the page, across the image', () => {
    const f = imageFrame();
    expect(f.block.width * f.scale + f.pad * 2).toBeCloseTo(IMAGE_WIDTH, 5);
    expect(f.block.x).toBeLessThan(BOOK_PAGE.margin.inside);
    expect(f.block.y).toBe(BOOK_PAGE.margin.top);
  });
});

describe('inkBands', () => {
  const paper = rgb('#f3ead7');
  const sheet = (w: number, h: number, ink: [number, number][]) => {
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) px.set([...paper, 255], i * 4);
    for (const [x, y] of ink) px.set([30, 26, 22, 255], (y * w + x) * 4);
    return px;
  };

  it('keeps lines close together as one run, cut to the first and last with words', () => {
    const px = sheet(10, 40, [
      [3, 6],
      [5, 12],
    ]);
    expect(inkBands(px, 10, [0, 40], [0, 10], paper, 10)).toEqual([[6, 12]]);
  });

  it('splits at a long empty stretch, so it can close up', () => {
    const px = sheet(10, 60, [
      [3, 5],
      [3, 50],
    ]);
    expect(inkBands(px, 10, [0, 60], [0, 10], paper, 10)).toEqual([
      [5, 5],
      [50, 50],
    ]);
  });

  it('ignores ink outside the text block: the running head and page number', () => {
    const px = sheet(10, 20, [
      [3, 1],
      [4, 8],
      [3, 19],
    ]);
    expect(inkBands(px, 10, [4, 16], [0, 10], paper, 10)).toEqual([[8, 8]]);
  });

  it('is empty for a page with no words', () => {
    expect(inkBands(sheet(4, 4, []), 4, [0, 4], [0, 4], paper, 2)).toEqual([]);
  });
});

describe('pageFileName', () => {
  it('names pages so they sort in reading order', () => {
    expect(pageFileName('Alice, in her own words', 3, 18)).toBe('alice-in-her-own-words-03.png');
    expect(pageFileName('!!!', 1, 5)).toBe('book-1.png');
  });
});
