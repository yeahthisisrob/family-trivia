/**
 * What playing trivia changes, as server data (docs/decisions/0035): the
 * answerer's points and story, who has played, the results, the timeline;
 * and, for a game played as a round, its high scores.
 */

import { useCallback } from 'react';
import { submitAnswer } from '../../../api';
import type { Question } from '../../../api/modules/trivia';
import { PERSON_STORY } from '../../../entities/family';
import { HIGH_SCORES } from '../../../entities/high-scores';
import { LEADERBOARD } from '../../../entities/leaderboard';
import { PROFILE } from '../../../entities/person';
import { TIMELINE } from '../../../entities/timeline';
import { useCircleInvalidate, useCircleMutation } from '../../../shared/api/query';
import { TRIVIA_GRID } from '../../who-has-played';

const PLAYED = [PROFILE, PERSON_STORY, TRIVIA_GRID, LEADERBOARD, TIMELINE] as const;

export interface TriviaAnswer {
  userId: string;
  groupId: string;
  question: Question;
  choice: string;
  catchingUp: boolean;
  isCustomCategory: boolean;
}

/**
 * Answer a trivia question. It resolves once saved, so the result shows at
 * once; the reads it changes are asked again behind it.
 */
export const useTriviaAnswer = () =>
  useCircleMutation({
    mutationFn: (a: TriviaAnswer) =>
      submitAnswer(a.userId, a.groupId, a.question, a.choice, a.catchingUp, a.isCustomCategory),
    invalidates: PLAYED,
    refreshInBackground: true,
  });

/**
 * Something played was saved outside this tab's answer: a game played as a
 * round saves its own answer and score, and an answer from another device
 * shows up as "no more questions".
 */
export const usePlayedElsewhere = () => {
  const invalidate = useCircleInvalidate();
  return useCallback(
    (what: 'round' | 'answer') =>
      void invalidate(...PLAYED, ...(what === 'round' ? [HIGH_SCORES] : [])),
    [invalidate],
  );
};
