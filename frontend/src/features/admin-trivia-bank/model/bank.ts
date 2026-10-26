/**
 * The trivia bank as an admin looks after it, as server data
 * (docs/decisions/0035): its numbers, a page of one category at one
 * difficulty, an import, a delete. Each change is sent once and asks again
 * for the bank's reads and the count on Admin › System.
 */
import { type BodyOf, callApi } from '../../../shared/api/contract';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { loadSession } from '../../../shared/session/session';
import { SYSTEM_INFO } from '../../admin-system';

const BANK = ['admin', 'trivia-bank'] as const;

export type ImportSource = BodyOf<'/admin/trivia-bank/import', 'post'>['source'];

/** A page of the bank: one category at one difficulty, from `offset`. */
export interface BankPage {
  category: string;
  difficulty: string;
  offset: number;
}

export const PAGE_SIZE = 20;
/** An import asks a source, or the AI, for dozens of questions: it can take minutes. */
const IMPORT_MS = 120_000;

const adminUserId = () => loadSession() ?? '';

export const useBankStats = () =>
  useCircleQuery({
    key: [...BANK, 'stats'],
    path: '/admin/trivia-bank/stats',
    query: { adminUserId: adminUserId() },
  });

/** None until a page is asked for; the last page stays on screen while the next loads. */
export const useBankPage = (page: BankPage | null) =>
  useCircleQuery({
    key: [...BANK, 'browse'],
    path: '/admin/trivia-bank/browse',
    query: {
      adminUserId: adminUserId(),
      category: page?.category ?? '',
      difficulty: page?.difficulty ?? '',
      offset: page?.offset ?? 0,
      limit: PAGE_SIZE,
    },
    enabled: !!page,
    keepPrevious: true,
  });

interface Import {
  source: ImportSource;
  category: string;
  difficulty: string;
  count: number;
}

/** It answers what was fetched, added, already there, or wrong. */
export const useImportQuestions = () =>
  useCircleMutation({
    mutationFn: (i: Import) =>
      callApi('/admin/trivia-bank/import', {
        method: 'post',
        once: true,
        timeoutMs: IMPORT_MS,
        body: { adminUserId: adminUserId(), ...i },
      }),
    invalidates: [BANK, SYSTEM_INFO],
  });

/** Take a question out of the bank, found by its text. */
export const useDeleteBankQuestion = () =>
  useCircleMutation({
    mutationFn: ({
      category,
      difficulty,
      question,
    }: Omit<BankPage, 'offset'> & { question: string }) =>
      callApi('/admin/trivia-bank/question', {
        method: 'delete',
        once: true,
        body: { adminUserId: adminUserId(), category, difficulty, questionText: question },
      }),
    invalidates: [BANK, SYSTEM_INFO],
  });
