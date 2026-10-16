import type {
  BookTone,
  BookVersion,
  BookWriting,
  SeasonBook,
  SeasonReview,
} from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

/** Writing a book's foreword takes the AI up to half a minute; give it a full one. */
const BOOK_TIMEOUT_MS = 60_000;

const post = <T>(path: string, body: unknown) =>
  apiService.request<T>(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    undefined,
    true,
    BOOK_TIMEOUT_MS,
  );

export const lookBackApi = {
  review: (season?: number) =>
    apiService.request<SeasonReview>(
      `/seasons/review${season ? `?season=${season}` : ''}`,
      { method: 'GET' },
      `season_review_${season ?? 'latest'}`,
    ),
  /** The foreword and chapter openings: written once per tone, unless asked fresh. */
  writeBook: (season: number, tone: BookTone, fresh = false) =>
    post<{ writing: BookWriting | null }>('/seasons/book/writing', { season, tone, fresh }),
  /** The print-ready PDF: kept until the season's answers change, unless asked fresh. */
  makeBook: (season: number, tone: BookTone, fresh = false) =>
    post<SeasonBook>('/seasons/book', { season, tone, fresh }),
  /** Every book made for the season; none is ever replaced. */
  versions: (season: number) =>
    apiService
      .request<{ versions: BookVersion[] }>(
        `/seasons/book/versions?season=${season}`,
        { method: 'GET' },
        undefined,
        true,
      )
      .then((r) => r.versions),
};
