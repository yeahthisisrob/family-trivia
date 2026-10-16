import { describe, expect, test } from 'vitest';
import { GRACE, MEMORIES } from '../ui/rememberingMocks';
import { keepsakeHtml } from './keepsake';

const base = {
  name: 'Grandma Grace',
  years: '1938 – 2024',
  dedication: 'Always in the garden.',
  remembering: GRACE,
  memories: MEMORIES,
  nameOf: (id: string) => ({ carol: 'Carol', bob: 'Bob' })[id] ?? id,
};

describe('keepsakeHtml', () => {
  test('a whole page: who, the family’s memories, then every answer by month', () => {
    const html = keepsakeHtml(base);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<h1>Grandma Grace</h1>');
    expect(html).toContain('Always in the garden.');
    expect(html).toContain('7 answers shared, May 2023 to February 2024.');
    expect(html.indexOf('Memories from the family')).toBeLessThan(html.indexOf('<h2>In '));
    expect(html).toContain('Carol ·');
    expect(html).toContain('<h3>May 2023</h3>');
    expect(html).toContain('“Call your sister more”');
  });

  test('what people typed is text, never markup', () => {
    const html = keepsakeHtml({
      ...base,
      memories: [
        {
          id: 'x',
          userId: 'bob',
          text: '<img src=x onerror=alert(1)>',
          timestamp: '2024-03-01T00:00:00Z',
        },
      ],
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x');
  });

  test('no memories, no empty section', () => {
    expect(keepsakeHtml({ ...base, memories: [] })).not.toContain('Memories from the family');
  });
});
