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
 *   - After submit, we advance via local queue state: the reads it starts
 *     from (dailyQuestion.ts) are asked again for the rest of Home, but the
 *     queue is built once, from answers that aren't being asked again.
 */

import { getTodayET } from '@family-trivia/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { generateQuestionOptions, type QuestionOption } from '../../../api/modules/facts';
import { knowledgeApi } from '../../../entities/family';
import { createLogger } from '../../../shared/lib/logger';
import {
  type FactHistory,
  type TodaysQuestion,
  useChooseQuestion,
  useFactHistory,
  useSkipQuestion,
  useSubmitAnswer,
  useTodaysQuestion,
} from './dailyQuestion';

const logger = createLogger('useDailyFactFlow');

// ── Types ────────────────────────────────────────────────────────

export type FlowStep =
  | 'loading'
  | 'question' // showing a question, waiting for answer
  | 'submitting' // submit in flight
  | 'response' // showing the AI fact response
  | 'firstPerson' // user is creator — pick category
  | 'firstPersonGen' // generating options
  | 'firstPersonPick' // pick from generated options
  | 'firstPersonDone' // confirmation animation
  | 'done'; // nothing more to do

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

// ── The queue ────────────────────────────────────────────────────

/** Today's creator still has to make today's question. */
const makesTodaysQuestion = (today: TodaysQuestion) =>
  !today.answered && (today.isFirstPerson || !today.question);

/** Past shared questions not answered or skipped, oldest first, then unanswered basics. */
function catchupQueue(history: FactHistory, now: number): CatchupItem[] {
  const answeredDates = new Set(
    history.history
      .filter((h) => h.questionType === 'shared' && (h.answered || h.skipped))
      .map((h) => h.date),
  );

  const today = getTodayET();
  const missed: CatchupItem[] = [];
  for (const sq of history.allSharedQuestions) {
    if (sq.date && sq.date !== today && !answeredDates.has(sq.date) && sq.question) {
      const diff = Math.floor((now - new Date(`${sq.date}T12:00:00`).getTime()) / 86400000);
      missed.push({ question: sq.question, date: sq.date, daysAgo: diff });
    }
  }
  // Oldest first: one queue that works back to now (docs/decisions/0016).
  missed.sort((a, b) => b.daysAgo - a.daysAgo);

  const basics: CatchupItem[] = [];
  history.basicQuestions.forEach((q, i) => {
    const done = history.history.some(
      (h) => h.questionType === 'basic' && h.questionIndex === i && h.answered,
    );
    if (!done) basics.push({ question: q, date: '', daysAgo: 999 });
  });

  return [...missed, ...basics];
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

  const today = useTodaysQuestion(userId);
  const history = useFactHistory(userId, !!today.data && !makesTodaysQuestion(today.data));
  const submitAnswer = useSubmitAnswer();
  const skipQuestion = useSkipQuestion();
  const chooseQuestion = useChooseQuestion();

  // ── Start, once: from today's question and, when there may be a queue, the history ──
  // Only from answers that have settled: a cached copy being asked again may be from
  // before the last answer.
  useEffect(() => {
    if (loadedRef.current) return;
    if (today.isError || history.isError) {
      loadedRef.current = true;
      logger.error('Failed to load fact questions', { err: today.error ?? history.error });
      setState((s) => ({ ...s, step: 'done' }));
      onDone?.();
      return;
    }
    if (!today.data || today.isFetching) return;
    const todayResult = today.data;

    // First-person flow — user creates today's question
    if (makesTodaysQuestion(todayResult)) {
      loadedRef.current = true;
      setState((s) => ({ ...s, step: 'firstPerson' }));
      return;
    }
    if (!history.data || history.isFetching) return;
    loadedRef.current = true;

    const catchupItems = catchupQueue(history.data, Date.now());
    queueRef.current = catchupItems;

    // Today's question takes priority
    if (!todayResult.answered && todayResult.question) {
      setState((s) => ({
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
    const [first, ...rest] = catchupItems;
    if (first) {
      queueRef.current = rest;
      setState((s) => ({
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

    setState((s) => ({ ...s, step: 'done' }));
    onDone?.();
  }, [
    today.data,
    today.isFetching,
    today.isError,
    today.error,
    history.data,
    history.isFetching,
    history.isError,
    history.error,
    onDone,
  ]);

  // ── Advance to next item in queue ────────────────────────────

  const advance = useCallback(() => {
    const queue = queueRef.current;

    // If we just answered today (not catch-up), the queue still has all items
    // because we never popped today. Start catch-up now.
    if (queue.length > 0) {
      const next = queue[0];
      queueRef.current = queue.slice(1);
      setState((s) => ({
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

    setState((s) => ({ ...s, step: 'done' }));
    onDone?.();
  }, [onDone]);

  // ── Submit answer ────────────────────────────────────────────

  const { mutateAsync: saveAnswer } = submitAnswer;
  const submit = useCallback(
    async (answer: string): Promise<boolean> => {
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

      setState((s) => ({ ...s, step: 'submitting', errorMessage: null }));

      try {
        const result = await saveAnswer({
          userId,
          question: submittedQuestion,
          answer: trimmed,
          catchup: submittedIsCatchup,
        });
        if (!result.fact) {
          // Defensive: backend should always return a fact for non-skipped submissions.
          logger.warn('submit returned no fact', { userId });
        }
        setState((s) => ({
          ...s,
          step: 'response',
          factResponse: result.fact || 'Thanks for sharing!',
        }));
        onFactSubmitted?.();
        knowledgeApi.refreshMine();
        return true;
      } catch (err) {
        logger.error('Failed to submit fact', { err });
        setState((s) => ({
          ...s,
          step: 'question', // back to question so they can retry
          errorMessage: 'Could not submit your answer. Please try again.',
        }));
        return false;
      }
    },
    [state.question, state.isCatchup, userId, onFactSubmitted, saveAnswer],
  );

  // ── Skip (explicit user action only) ─────────────────────────

  const { mutateAsync: saveSkip } = skipQuestion;
  const skip = useCallback(async (): Promise<boolean> => {
    const skippedQuestion = state.question;
    const skippedIsCatchup = state.isCatchup;
    if (!skippedQuestion) return false;

    setState((s) => ({ ...s, step: 'submitting', errorMessage: null }));
    try {
      await saveSkip({ userId, question: skippedQuestion, catchup: skippedIsCatchup });
      onFactSubmitted?.();
      advance();
      return true;
    } catch (err) {
      logger.error('Failed to skip fact', { err });
      setState((s) => ({
        ...s,
        step: 'question',
        errorMessage: 'Could not skip. Please try again.',
      }));
      return false;
    }
  }, [state.question, state.isCatchup, userId, onFactSubmitted, advance, saveSkip]);

  // ── First-person flow ────────────────────────────────────────

  const setFpTheme = useCallback((theme: string) => {
    setState((s) => ({ ...s, fpTheme: theme }));
  }, []);

  const generateFpOptions = useCallback(async () => {
    setState((s) => ({ ...s, step: 'firstPersonGen' }));
    try {
      const result = await generateQuestionOptions(userId, state.fpTheme || undefined);
      setState((s) => ({
        ...s,
        step: 'firstPersonPick',
        fpOptions: result.options || [],
      }));
    } catch (err) {
      logger.error('Failed to generate options', { err });
      setState((s) => ({
        ...s,
        step: 'firstPerson',
        errorMessage: 'Could not generate questions. Please try again.',
      }));
    }
  }, [userId, state.fpTheme]);

  const { mutateAsync: saveQuestion } = chooseQuestion;
  const selectFpQuestion = useCallback(
    async (question: string) => {
      setState((s) => ({ ...s, step: 'firstPersonDone' }));
      try {
        const result = await saveQuestion({ userId, question });
        const finalQuestion = result.question || question;
        // Brief celebration, then transition to question step
        setTimeout(() => {
          setState((s) => ({
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
        setState((s) => ({
          ...s,
          step: 'firstPersonPick',
          errorMessage: 'Could not save the question. Please try again.',
        }));
      }
    },
    [userId, saveQuestion],
  );

  const skipFirstPerson = useCallback(async () => {
    setState((s) => ({ ...s, step: 'submitting' }));
    try {
      await saveSkip({ userId, question: '', catchup: false });
    } catch {
      // It's OK if this fails — moving on either way
    }
    setState((s) => ({ ...s, step: 'done' }));
    onDone?.();
  }, [userId, onDone, saveSkip]);

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
