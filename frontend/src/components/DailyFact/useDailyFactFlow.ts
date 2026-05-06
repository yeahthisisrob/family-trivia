/**
 * useDailyFactFlow — single state machine for the daily fact UX.
 *
 * Owns the full flow:
 *   loading → question (today or catch-up) → response → done
 *   loading → firstPerson → categoryPick → optionPick → confirmation → question → ...
 *
 * Why a hook (not in the component): the state machine is the hard part.
 * Keeping it isolated makes the rendering component dumb and lets us test
 * the flow without touching MUI.
 *
 * Bug-hardening:
 *   - submit() and skip() are the ONLY entry points that touch the API.
 *     No timer, no auto-advance ever calls skip — skips are explicit.
 *   - The submitted question text is the EXACT one we received from the
 *     backend. We never send a stale or mutated question string.
 *   - After submit, we advance via local queue state, never re-fetching.
 */

import { getTodayET } from '@family-trivia/shared';
import { useState, useEffect, useCallback, useRef } from 'react';

import {
  getDailyFact,
  submitDailyFact,
  skipDailyFact,
  generateDailyFactWithTheme,
  generateQuestionOptions,
  getUserFactHistory,
  QuestionOption,
} from '../../api/modules/facts';
import { createLogger } from '../../utils/logger';

import type { FactHistoryItem } from '@family-trivia/shared';

const logger = createLogger('useDailyFactFlow');

// ── Types ────────────────────────────────────────────────────────

export type FlowStep =
  | 'loading'
  | 'question'         // showing a question, waiting for answer
  | 'submitting'       // submit in flight
  | 'response'         // showing the AI fact response
  | 'firstPerson'      // user is creator — pick category
  | 'firstPersonGen'   // generating options
  | 'firstPersonPick'  // pick from generated options
  | 'firstPersonDone'  // confirmation animation
  | 'done';            // nothing more to do

export interface CatchupItem {
  question: string;
  /** YYYY-MM-DD for missed shared, '' for unanswered basics */
  date: string;
  daysAgo: number;
}

export interface DailyFactFlowState {
  step: FlowStep;
  question: string;
  /** YYYY-MM-DD if catch-up question from a prior day */
  questionDate: string | null;
  /** True if the active question is a catch-up (not today's daily) */
  isCatchup: boolean;
  /** Total catch-up items in this session */
  totalCatchup: number;
  /** How many catch-up items remain (excluding current) */
  catchupRemaining: number;
  /** AI-generated fact to show after a successful submit */
  factResponse: string | null;
  /** Error message to surface to user */
  errorMessage: string | null;
  // First-person sub-state
  fpTheme: string;
  fpOptions: QuestionOption[];
}

export interface DailyFactFlowActions {
  /** Returns true on success so the caller can clear local input. */
  submit: (answer: string) => Promise<boolean>;
  /** Returns true on success so the caller can clear local input. */
  skip: () => Promise<boolean>;
  // First-person actions
  setFpTheme: (theme: string) => void;
  generateFpOptions: () => Promise<void>;
  selectFpQuestion: (question: string) => Promise<void>;
  skipFirstPerson: () => Promise<void>;
}

interface UseDailyFactFlowOptions {
  userId: string;
  onFactSubmitted?: () => void;
  onDone?: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────

const initialState: DailyFactFlowState = {
  step: 'loading',
  question: '',
  questionDate: null,
  isCatchup: false,
  totalCatchup: 0,
  catchupRemaining: 0,
  factResponse: null,
  errorMessage: null,
  fpTheme: '',
  fpOptions: [],
};

export function useDailyFactFlow({
  userId,
  onFactSubmitted,
  onDone,
}: UseDailyFactFlowOptions): [DailyFactFlowState, DailyFactFlowActions] {
  const [state, setState] = useState<DailyFactFlowState>(initialState);
  /** Catch-up queue lives in a ref so submit handlers don't need to re-bind. */
  const queueRef = useRef<CatchupItem[]>([]);
  const loadedRef = useRef(false);

  // ── Initial load ─────────────────────────────────────────────

  const loadQuestions = useCallback(async () => {
    try {
      const todayResult = await getDailyFact(userId, false);

      // First-person flow — user creates today's question
      if (!todayResult.answered && (todayResult.isFirstPerson || !todayResult.question)) {
        setState(s => ({ ...s, step: 'firstPerson' }));
        return;
      }

      // Build catch-up queue from history
      const history = await getUserFactHistory(userId, true);
      const answeredDates = new Set(
        history.history
          .filter((h: FactHistoryItem) => h.questionType === 'shared' && (h.answered || h.skipped))
          .map((h: FactHistoryItem) => h.date),
      );

      const today = getTodayET();
      const missed: CatchupItem[] = [];
      for (const sq of history.allSharedQuestions) {
        if (sq.date && sq.date !== today && !answeredDates.has(sq.date) && !sq.skipped && sq.question) {
          const diff = Math.floor((Date.now() - new Date(sq.date + 'T12:00:00').getTime()) / 86400000);
          missed.push({ question: sq.question, date: sq.date, daysAgo: diff });
        }
      }
      missed.sort((a, b) => a.daysAgo - b.daysAgo);

      const basics: CatchupItem[] = [];
      history.basicQuestions.forEach((q: string, i: number) => {
        const done = history.history.some(
          (h: FactHistoryItem) => h.questionType === 'basic' && h.questionIndex === i && h.answered,
        );
        if (!done) basics.push({ question: q, date: '', daysAgo: 999 });
      });

      const catchupItems = [...missed, ...basics];
      queueRef.current = catchupItems;

      // Today's question takes priority
      if (!todayResult.answered && todayResult.question) {
        setState(s => ({
          ...s,
          step: 'question',
          question: todayResult.question,
          questionDate: null,
          isCatchup: false,
          totalCatchup: catchupItems.length,
          catchupRemaining: catchupItems.length,
        }));
        return;
      }

      // Today already done — start catch-up if any
      if (catchupItems.length > 0) {
        const first = catchupItems[0];
        queueRef.current = catchupItems.slice(1);
        setState(s => ({
          ...s,
          step: 'question',
          question: first.question,
          questionDate: first.date || null,
          isCatchup: true,
          totalCatchup: catchupItems.length,
          catchupRemaining: catchupItems.length - 1,
        }));
        return;
      }

      setState(s => ({ ...s, step: 'done' }));
      onDone?.();
    } catch (err) {
      logger.error('Failed to load fact questions', { err });
      setState(s => ({ ...s, step: 'done' }));
      onDone?.();
    }
  }, [userId, onDone]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legitimate fetch-on-mount
    void loadQuestions();
  }, [loadQuestions]);

  // ── Advance to next item in queue ────────────────────────────

  const advance = useCallback(() => {
    const queue = queueRef.current;

    // If we just answered today (not catch-up), the queue still has all items
    // because we never popped today. Start catch-up now.
    if (queue.length > 0) {
      const next = queue[0];
      queueRef.current = queue.slice(1);
      setState(s => ({
        ...s,
        step: 'question',
        question: next.question,
        questionDate: next.date || null,
        isCatchup: true,
        catchupRemaining: queue.length - 1,
        factResponse: null,
        errorMessage: null,
      }));
      return;
    }

    setState(s => ({ ...s, step: 'done' }));
    onDone?.();
  }, [onDone]);

  // ── Submit answer ────────────────────────────────────────────

  const submit = useCallback(async (answer: string): Promise<boolean> => {
    const trimmed = answer.trim();
    if (!trimmed) return false;

    // Snapshot the question + isCatchup at submit time so we send EXACTLY
    // what's on screen — never a stale or wrong-mode value.
    const submittedQuestion = state.question;
    const submittedIsCatchup = state.isCatchup;
    if (!submittedQuestion) {
      logger.error('submit called with no active question');
      return false;
    }

    setState(s => ({ ...s, step: 'submitting', errorMessage: null }));

    try {
      const result = await submitDailyFact(userId, submittedQuestion, trimmed, submittedIsCatchup);
      if (!result.fact) {
        // Defensive: backend should always return a fact for non-skipped submissions.
        logger.warn('submit returned no fact', { userId });
      }
      setState(s => ({
        ...s,
        step: 'response',
        factResponse: result.fact || 'Thanks for sharing!',
      }));
      onFactSubmitted?.();
      return true;
    } catch (err) {
      logger.error('Failed to submit fact', { err });
      setState(s => ({
        ...s,
        step: 'question', // back to question so they can retry
        errorMessage: 'Could not submit your answer. Please try again.',
      }));
      return false;
    }
  }, [state.question, state.isCatchup, userId, onFactSubmitted]);

  // ── Skip (explicit user action only) ─────────────────────────

  const skip = useCallback(async (): Promise<boolean> => {
    const skippedQuestion = state.question;
    const skippedIsCatchup = state.isCatchup;
    if (!skippedQuestion) return false;

    setState(s => ({ ...s, step: 'submitting', errorMessage: null }));
    try {
      await skipDailyFact(userId, skippedQuestion, skippedIsCatchup);
      onFactSubmitted?.();
      advance();
      return true;
    } catch (err) {
      logger.error('Failed to skip fact', { err });
      setState(s => ({
        ...s,
        step: 'question',
        errorMessage: 'Could not skip. Please try again.',
      }));
      return false;
    }
  }, [state.question, state.isCatchup, userId, onFactSubmitted, advance]);

  // ── First-person flow ────────────────────────────────────────

  const setFpTheme = useCallback((theme: string) => {
    setState(s => ({ ...s, fpTheme: theme }));
  }, []);

  const generateFpOptions = useCallback(async () => {
    setState(s => ({ ...s, step: 'firstPersonGen' }));
    try {
      const result = await generateQuestionOptions(userId, state.fpTheme || undefined);
      setState(s => ({
        ...s,
        step: 'firstPersonPick',
        fpOptions: result.options || [],
      }));
    } catch (err) {
      logger.error('Failed to generate options', { err });
      setState(s => ({
        ...s,
        step: 'firstPerson',
        errorMessage: 'Could not generate questions. Please try again.',
      }));
    }
  }, [userId, state.fpTheme]);

  const selectFpQuestion = useCallback(async (question: string) => {
    setState(s => ({ ...s, step: 'firstPersonDone' }));
    try {
      const result = await generateDailyFactWithTheme(userId, question, false);
      const finalQuestion = result.question || question;
      // Brief celebration, then transition to question step
      setTimeout(() => {
        setState(s => ({
          ...s,
          step: 'question',
          question: finalQuestion,
          questionDate: null,
          isCatchup: false,
          fpOptions: [],
          fpTheme: '',
        }));
      }, 1500);
    } catch (err) {
      logger.error('Failed to save question', { err });
      setState(s => ({
        ...s,
        step: 'firstPersonPick',
        errorMessage: 'Could not save the question. Please try again.',
      }));
    }
  }, [userId]);

  const skipFirstPerson = useCallback(async () => {
    setState(s => ({ ...s, step: 'submitting' }));
    try {
      await skipDailyFact(userId, '');
    } catch {
      // It's OK if this fails — moving on either way
    }
    setState(s => ({ ...s, step: 'done' }));
    onDone?.();
  }, [userId, onDone]);

  // Auto-advance from response → next question after the fact has been read
  useEffect(() => {
    if (state.step !== 'response') return;
    const t = setTimeout(advance, 2800);
    return () => clearTimeout(t);
  }, [state.step, advance]);

  return [
    state,
    {
      submit,
      skip,
      setFpTheme,
      generateFpOptions,
      selectFpQuestion,
      skipFirstPerson,
    },
  ];
}
