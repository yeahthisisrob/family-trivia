import { describe, expect, test } from 'vitest';
import { SUMMER } from '../ui/lookBackMocks';
import { bookHtml, seasonDates } from './book';

const nameOf = (id: string) => ({ bob: 'Bob', carol: 'Carol' })[id] ?? id;

describe('the season’s book', () => {
  test('every day’s question under its month, with everyone’s answers', () => {
    const html = bookHtml(SUMMER, 'The Example Family', nameOf);
    expect(html).toContain('<h1>Summer</h1>');
    expect(html).toContain('The Example Family · June 2025 to July 2025');
    expect(html).toContain('<h2>June 2025</h2>');
    expect(html).toContain('<h2>July 2025</h2>');
    expect(html.match(/<h2>June 2025<\/h2>/g)).toHaveLength(1);
    expect(html).toContain('<span class="who">Carol:</span> Moon River');
  });

  test('answers are text, never markup', () => {
    const r = {
      ...SUMMER,
      book: [{ ...SUMMER.book[0]!, answers: [{ personId: 'bob', answer: '<b>hi</b>' }] }],
    };
    expect(bookHtml(r, 'F', nameOf)).toContain('&lt;b&gt;hi&lt;/b&gt;');
  });

  test('a season still running says since when', () => {
    expect(seasonDates({ ...SUMMER.season, endDate: null })).toBe('Since June 2025');
  });
});
