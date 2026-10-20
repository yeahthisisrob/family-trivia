import type { Invite } from '@family-trivia/shared';
import { useRefreshAppInit } from '../../../contexts/FamilyDataContext';
import { FAMILY, GRAPH } from '../../../entities/family';
import { problemOf } from '../../../shared/admin-ui';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { invitesApi, type NewInvite } from '../api/invitesApi';

const INVITES = ['admin', 'invites'] as const;

/**
 * This circle's invite links and waiting joins, as server data
 * (docs/decisions/0035), asked again after each change. Letting someone in
 * adds them to the family, so that asks for the family (and /app-init's
 * members, until step 5) again too. None of it is shown before the server
 * has it, and none of it is retried.
 */
export function useInvites() {
  const read = useCircleQuery({ key: INVITES, path: '/admin/invites' });
  const refreshAppInit = useRefreshAppInit();
  const creating = useCircleMutation({ mutationFn: invitesApi.create, invalidates: [INVITES] });
  const revoking = useCircleMutation({ mutationFn: invitesApi.revoke, invalidates: [INVITES] });
  const deciding = useCircleMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      invitesApi.decide(id, approve),
    invalidates: [INVITES, FAMILY, GRAPH],
    onSuccess: (decided) => {
      if (decided.userId) void refreshAppInit();
    },
  });

  return {
    invites: read.data?.invites ?? [],
    joins: read.data?.joins ?? [],
    loaded: !read.isPending,
    create: async (i: NewInvite): Promise<Invite> => (await creating.mutateAsync(i)).invite,
    revoke: (token: string) => revoking.mutate(token),
    decide: (id: string, approve: boolean) => deciding.mutate({ id, approve }),
    /** A link taken back or a join answered that didn't save. */
    problem: problemOf(revoking.error ?? deciding.error),
  };
}
