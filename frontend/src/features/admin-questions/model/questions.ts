/**
 * The last two weeks of shared daily questions, as an admin sees them
 * (docs/decisions/0035). Deleting one also takes everyone's answers to it
 * out of their histories, so it asks again for every read an answer shows in.
 */
import { callApi } from '../../../shared/api/contract';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { loadSession } from '../../../shared/session/session';
import { ANSWERED } from '../../daily-question';

const ADMIN_QUESTIONS = ['admin', 'daily-questions'] as const;
const adminUserId = () => loadSession() ?? '';

export const useAdminQuestions = () =>
  useCircleQuery({
    key: ADMIN_QUESTIONS,
    path: '/admin/daily-questions',
    query: { adminUserId: adminUserId() },
    select: (answer) => [...answer.questions].sort((a, b) => b.date.localeCompare(a.date)),
  });

/** Destructive: asked for first, never retried, nothing changes on screen until it's done. */
export const useDeleteQuestion = () =>
  useCircleMutation({
    mutationFn: (date: string) =>
      callApi('/admin/daily-questions', {
        method: 'delete',
        once: true,
        body: { adminUserId: adminUserId(), date },
      }),
    invalidates: [ADMIN_QUESTIONS, ...ANSWERED],
  });
