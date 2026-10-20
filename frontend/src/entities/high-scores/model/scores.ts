/**
^ * Each game's high scores, as server data (docs/decisions/0035): one board
 * per game, asked when its game is on screen, so opening the Arcade is one
 * request, not one per game.
 */
import type { ResponseOf } from '../../../shared/api/contract';
import { useCircleQuery } from '../../../shared/api/query';

/** A game's score saved, in the Arcade or as a round, changes them. */
export const HIGH_SCORES = ['high-scores'] as const;

const scoresOf = (answer: ResponseOf<'/games/scores'>) => answer.scores;

export const useHighScores = (game: string, enabled: boolean) =>
  useCircleQuery({
    key: HIGH_SCORES,
    path: '/games/scores',
    query: { game },
    select: scoresOf,
    enabled,
  });
