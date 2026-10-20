/**
 * What the app has to say about one person, as server data (docs/decisions/0035):
 * their trivia in numbers, and the spotlight the AI writes about them.
 */
import { useCircleQuery } from '../../../shared/api/query';

/** Someone's trivia (points, how they were scored): any trivia answer changes it. */
export const PROFILE = ['profile'] as const;
const SUMMARY = ['member-summary'] as const;

export const useTriviaProfile = (userId: string) =>
  useCircleQuery({ key: PROFILE, path: '/user-profile', query: { userId } });

/** The spotlight's few lines about them, kind or a roast. */
export const useMemberSummary = (
  userId: string,
  mode: 'regular' | 'roast' = 'regular',
  enabled = true,
) => useCircleQuery({ key: SUMMARY, path: '/member-summary', query: { userId, mode }, enabled });
