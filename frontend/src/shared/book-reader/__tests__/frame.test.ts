import { BOOK_PAGE } from '@family-trivia/shared';
import { describe, expect, it } from 'vitest';
import {
  IMAGE_WIDTH,
  imageFrame,
  inkBands,
  pageFileName,
  pressScale,
  rgb,
  spreads,
} from '../frame';

describe('imageFrame', () => {
  it('sets the text block, not the page, across the image', () => {
    const f = imageFrame();
    expect(f.block.width * f.scale + f.pad * 2).toBeCloseTo(IMAGE_WIDTH, 5);
    expect(f.block.x).toBeLessThan(BOOK_PAGE.margin.inside);
    expect(f.block.y).toBe(BOOK_PAGE.margin.top);
  });

  it('follows a book set smaller: narrower margins, a wider block', () => {
    const small = imageFrame(0.9);
    expect(small.block.y).toBeCloseTo(BOOK_PAGE.margin.top * 0.9, 5);
    expect(small.block.width).toBeGreaterThan(imageFrame().block.width);
  });
});

describe('pressScale', () => {
  it('reads the size from the book’s keywords, and is 1 when it can’t', () => {
    expect(pressScale('press-scale:0.94')).toBe(0.94);
    expect(pressScale(undefined)).toBe(1);
    expect(pressScale('press-scale:40')).toBe(1);
  });
});

describe('spreads', () => {
  it('pairs pages as an open book does: the first alone on the right, then facing pages', () => {
    expect(spreads([1, 2, 3, 4, 5, 6])).toEqual([[1], [2, 3], [4, 5], [6]]);
  });

  it('leaves a page alone when the page it faces was a skipped blank', () => {
    expect(spreads([1, 3, 4, 5])).toEqual([[1], [3], [4, 5]]);
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
