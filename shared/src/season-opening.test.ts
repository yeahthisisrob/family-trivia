import { describe, expect, it } from 'vitest';
import { openingLetter, opensRecently } from './season-opening';

describe('a season opening on its own', () => {
  it('says what this season is, in its circle’s words', () => {
    const { title, markdown } = openingLetter(
      { name: 'Season 1', trivia: 'off', pace: 'weekly' },
      { kind: 'friends', first: true },
    );
    expect(title).toBe('Season 1 begins');
    expect(markdown).toContain('the first season for the crew');
    expect(markdown).toContain('No trivia this time');
    expect(markdown).toContain('A new question about us each week.');
    expect(markdown).not.toContain('trivia question');
    expect(markdown).not.toContain('Teams');
  });

  it('leaves last season out when nothing was said in it', () => {
    const { markdown } = openingLetter(
      { name: 'Fall' },
      { kind: 'family', first: false, last: { name: 'Spring', people: 0, answers: 0 } },
    );
    expect(markdown).not.toContain('Spring');
    expect(markdown).toContain('A new question about us every day.');
  });

  it('shows for the first two weeks only', () => {
    expect(opensRecently({ startDate: '2026-10-01' }, '2026-10-15')).toBe(true);
    expect(opensRecently({ startDate: '2026-10-01' }, '2026-10-16')).toBe(false);
    expect(opensRecently({ startDate: '2026-10-20' }, '2026-10-19')).toBe(false);
  });
});
