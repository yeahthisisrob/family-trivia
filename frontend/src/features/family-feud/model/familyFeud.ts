/**
 * Family Feud on Home, as server data (docs/decisions/0035). Reading the
 * status also finishes a round whose time is up, on the server. Every move
 * (start, pass, answer, guess) asks for the status again before it resolves,
 * so the card shows what the move did.
 */
import {
  passFamilyFeudTurn,
  startFamilyFeudRound,
  submitFamilyFeudAnswer,
  submitFamilyFeudGuess,
} from '../../../api/modules/familyFeud';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';

/** Home's Family Feud card; an admin's reset or delete changes it too. */
export const FAMILY_FEUD = ['family-feud'] as const;

/** Asked once the app has started, so it doesn't hold up the first load. */
export const useFeudStatus = (userId: string, enabled: boolean) =>
  useCircleQuery({ key: FAMILY_FEUD, path: '/family-feud/status', query: { userId }, enabled });

const useMove = <T, V>(mutationFn: (vars: V) => Promise<T>) =>
  useCircleMutation({ mutationFn, invalidates: [FAMILY_FEUD] });

export const useStartRound = () => useMove((userId: string) => startFamilyFeudRound(userId));
export const usePassTurn = () => useMove((userId: string) => passFamilyFeudTurn(userId));
export const useAnswerRound = () =>
  useMove(({ userId, answer }: { userId: string; answer: string }) =>
    submitFamilyFeudAnswer(userId, answer),
  );
export const useGuess = () =>
  useMove(({ userId, guess }: { userId: string; guess: string }) =>
    submitFamilyFeudGuess(userId, guess),
  );
