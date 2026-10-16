import { isDownloadKey } from '../services/media';

test('archives, books and covers can be downloaded; nothing else', () => {
  for (const ok of [
    'exports/rob/2026-10-16T21-00-00-000Z.zip',
    'books/season-2/warm/2026-10-16T21-12-43-163Z.pdf',
    'books/season-2/warm/2026-10-16T21-12-43-163Z.cover.pdf',
    'books/season-1/plain/2026-10-16T21-12-43-163Z.pdf',
    'books/people/grace/2026-10-16T21-12-43-163Z.pdf',
  ])
    expect(isDownloadKey(ok)).toBe(true);
  for (const no of [
    'books/season-2/warm.writing.json',
    'books/season-2/warm/2026.input.json',
    'facts/answers/grace.json',
    'config/users.json',
    'books/../config/users.pdf',
    'media/photo.jpg',
  ])
    expect(isDownloadKey(no)).toBe(false);
});
