import type { Invite, PendingJoin } from '@family-trivia/shared';
import { useCallback, useEffect, useState } from 'react';
import { invitesApi, type NewInvite } from '../api/invitesApi';

/** This circle's invite links and waiting joins, kept fresh after each change. */
export function useInvites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [joins, setJoins] = useState<PendingJoin[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const r = await invitesApi.list();
    setInvites(r.invites);
    setJoins(r.joins);
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload().catch(() => setLoaded(true));
  }, [reload]);

  const create = useCallback(
    async (i: NewInvite) => {
      const { invite } = await invitesApi.create(i);
      await reload();
      return invite;
    },
    [reload],
  );

  const revoke = useCallback(
    async (token: string) => {
      await invitesApi.revoke(token);
      await reload();
    },
    [reload],
  );

  const decide = useCallback(
    async (id: string, approve: boolean) => {
      setJoins((js) => js.filter((j) => j.id !== id)); // answer feels instant
      await invitesApi.decide(id, approve);
      await reload();
    },
    [reload],
  );

  return { invites, joins, loaded, create, revoke, decide };
}
