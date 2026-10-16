import type { SeasonReview } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

export const lookBackApi = {
  review: (season?: number) =>
    apiService.request<SeasonReview>(
      `/seasons/review${season ? `?season=${season}` : ''}`,
      { method: 'GET' },
      `season_review_${season ?? 'latest'}`,
    ),
};
