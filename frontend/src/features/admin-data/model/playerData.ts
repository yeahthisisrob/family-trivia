/**
 * Player Data, as server data (docs/decisions/0035): one person's facts and
 * trivia answers, the plays left open across the circle, and Family Feud as
 * stored. Each change is sent once and asks again for every read that shows
 * what it changed: a fact shows wherever an answer to the day's question
 * does, a trivia answer wherever playing shows, and a Feud round on Home's
 * card, in the results (its points), the timeline and the week's answers.
 */
import { LEADERBOARD } from '../../../entities/leaderboard';
import { TIMELINE } from '../../../entities/timeline';
import { type BodyOf, callApi, type ResponseOf } from '../../../shared/api/contract';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { loadSession } from '../../../shared/session/session';
import { ANSWERED } from '../../daily-question';
import { FACT_SUMMARY } from '../../fact-summary';
import { FAMILY_FEUD } from '../../family-feud';
import { PLAYED } from '../../trivia';

const PLAYER_DATA = ['admin', 'player-data'] as const;
const FACTS = [...PLAYER_DATA, 'facts'] as const;
const TRIVIA = [...PLAYER_DATA, 'trivia'] as const;
const OPEN_PLAYS = [...PLAYER_DATA, 'open-plays'] as const;
const FEUD = [...PLAYER_DATA, 'family-feud'] as const;

export type AdminFact = ResponseOf<'/admin/user-facts'>['facts'][number];
export type AdminTrivia = ResponseOf<'/admin/user-trivia'>['history'][number];
export type OpenPlay = ResponseOf<'/admin/game-sessions'>['sessions'][number];
export type FeudAction = BodyOf<'/admin/family-feud', 'delete'>['action'];
type FactChange = BodyOf<'/admin/user-facts', 'put'>;
/** What the edit dialog can change in one entry. */
export type FactEdit = Pick<
  FactChange,
  'answer' | 'question' | 'newQuestionType' | 'newQuestionIndex' | 'newDate'
>;

const adminUserId = () => loadSession() ?? '';

/** Newest first. */
export const usePlayerFacts = (userId: string) =>
  useCircleQuery({
    key: FACTS,
    path: '/admin/user-facts',
    query: { adminUserId: adminUserId(), userId },
    enabled: !!userId,
    select: (answer) => [...answer.facts].sort((a, b) => b.date.localeCompare(a.date)),
  });

/** Newest first. */
export const usePlayerTrivia = (userId: string) =>
  useCircleQuery({
    key: TRIVIA,
    path: '/admin/user-trivia',
    query: { adminUserId: adminUserId(), userId },
    enabled: !!userId,
    select: (answer) => [...answer.history].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
  });

/** Every game's plays left open, across the circle. */
export const useOpenPlays = (enabled: boolean) =>
  useCircleQuery({
    key: OPEN_PLAYS,
    path: '/admin/game-sessions',
    query: { adminUserId: adminUserId() },
    enabled,
    select: (answer) => answer.sessions,
  });

export const useAdminFeud = (enabled: boolean) =>
  useCircleQuery({
    key: FEUD,
    path: '/admin/family-feud',
    query: { adminUserId: adminUserId() },
    enabled,
  });

interface FactAt {
  userId: string;
  timestamp: string;
}

/** Change one entry, found by its timestamp. */
export const useEditFact = () =>
  useCircleMutation({
    mutationFn: ({ userId, timestamp, ...changes }: FactAt & FactEdit) =>
      callApi('/admin/user-facts', {
        method: 'put',
        once: true,
        body: { adminUserId: adminUserId(), userId, timestamp, ...changes },
      }),
    invalidates: [FACTS, ...ANSWERED],
  });

/** Delete exactly one entry, found by its timestamp. */
export const useDeleteFact = () =>
  useCircleMutation({
    mutationFn: ({ userId, timestamp }: FactAt) =>
      callApi('/admin/user-facts', {
        method: 'delete',
        once: true,
        body: { adminUserId: adminUserId(), userId, timestamp },
      }),
    invalidates: [FACTS, ...ANSWERED],
  });

/** Take one trivia answer back: they can answer it again. */
export const useDeleteTrivia = () =>
  useCircleMutation({
    mutationFn: ({ userId, timestamp }: FactAt) =>
      callApi('/admin/user-trivia', {
        method: 'delete',
        once: true,
        body: { adminUserId: adminUserId(), userId, timestamps: [timestamp] },
      }),
    invalidates: [TRIVIA, ...PLAYED],
  });

/**
 * Close someone's open play so they can play again. Whether a round can be
 * played comes with the Trivia tab's status, a context until step 5.
 */
export const useClosePlay = () =>
  useCircleMutation({
    mutationFn: ({ userId, game }: { userId: string; game: string }) =>
      callApi('/admin/game-sessions', {
        method: 'delete',
        once: true,
        body: { adminUserId: adminUserId(), userId, gameType: game },
      }),
    invalidates: [OPEN_PLAYS],
  });

/** Reset the current round, delete one, or reset the rotation. */
export const useFeudChange = () =>
  useCircleMutation({
    mutationFn: ({ action, roundId }: { action: FeudAction; roundId?: string }) =>
      callApi('/admin/family-feud', {
        method: 'delete',
        once: true,
        body: { adminUserId: adminUserId(), action, roundId },
      }),
    invalidates: [FEUD, FAMILY_FEUD, LEADERBOARD, TIMELINE, FACT_SUMMARY],
  });
