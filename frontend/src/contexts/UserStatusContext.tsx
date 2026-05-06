/**
 * UserStatusContext — mirrors the backend's eligibility model.
 *
 * Backend rules (from playerStateService):
 * 1. 1 daily trivia per day (regular or game mode)
 * 2. Catch-up bypasses daily limit, gated only by gaps
 * 3. hasPlayedToday = any non-catchup slot today
 * 4. catchupBehind = leader's slots - your slots
 *
 * This context derives eligibility from FamilyDataContext init data.
 * After answering, call refreshUserStatus() to re-fetch from backend.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

import * as api from '../api';
import { useFamilyData } from './FamilyDataContext';
import { cacheService } from '../services/CacheService';
import { createLogger } from '../utils/logger';

const logger = createLogger('UserStatusContext');

// ── Types ────────────────────────────────────────────────────────

interface Question {
  question: string;
  choices: string[];
  answer: string;
  category?: string;
  difficulty?: 'easy' | 'normal' | 'hard';
  pointMultiplier?: number;
}

interface CatchupStatus {
  questionsBehind: number;
  userAnswerCount: number;
  maxQuestionsAvailable: number;
}

interface UserStatusContextType {
  /** True until eligibility data is loaded. TriviaFlow gates on this. */
  loading: boolean;
  /** Has played their daily trivia today (non-catchup) */
  hasAnsweredToday: boolean;
  /** Can play a regular/game-mode question right now */
  canAnswerQuestion: boolean;
  /** Catch-up status (null until loaded) */
  catchupStatus: CatchupStatus | null;
  /** Today's date in ET */
  todayET: string;
  // Session state (in-memory only)
  todayResult: { correct: boolean; streak: number; pointsEarned?: number } | null;
  lastQuestion: Question | null;
  lastAnswer: string | null;
  /** @deprecated Use loading */
  loadingCatchup: boolean;
  // Methods
  refreshUserStatus: () => Promise<void>;
  clearTodayResult: () => void;
  updateCatchupStatus: (status: CatchupStatus) => void;
  setAnswerResult: (
    result: { correct: boolean; streak: number; pointsEarned?: number },
    question?: Question,
    selected?: string,
  ) => void;
  shouldShowQuestionStatus: () => boolean;
}

export const UserStatusContext = createContext<UserStatusContextType | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────────

export const UserStatusProvider: React.FC<{
  children: React.ReactNode;
  userId: string | null;
  authValid: boolean;
}> = ({ children, userId, authValid }) => {
  const { initQuestionAvailability, initCatchupStatus, appInitComplete } = useFamilyData();

  // Backend-fetched overrides (set after refreshUserStatus or fallback)
  const [fetchedAvailability, setFetchedAvailability] = useState<{
    canAnswer: boolean; todayET: string;
  } | null>(null);
  const [fetchedCatchup, setFetchedCatchup] = useState<CatchupStatus | null>(null);

  // Session state (in-memory, local to this page load)
  const [todayResult, setTodayResult] = useState<{
    correct: boolean; streak: number; pointsEarned?: number;
  } | null>(null);
  const [lastQuestion, setLastQuestion] = useState<Question | null>(null);
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  // Local override: set to true after answering daily (optimistic update)
  const [answeredThisSession, setAnsweredThisSession] = useState(false);

  // ── Derived state (no effects, no refs, no timing issues) ──────

  // Availability: fetched override > init data > defaults
  const availability = useMemo(() =>
    fetchedAvailability ?? (
      appInitComplete && initQuestionAvailability
        ? { canAnswer: initQuestionAvailability.canAnswer, todayET: initQuestionAvailability.todayET }
        : null
    ),
    [fetchedAvailability, appInitComplete, initQuestionAvailability],
  );

  const loading = !availability;
  const canAnswerQuestion = answeredThisSession ? false : (availability?.canAnswer ?? false);
  const hasAnsweredToday = answeredThisSession || !(availability?.canAnswer ?? true);
  const todayET = availability?.todayET ?? '';

  // Catchup: fetched override > deferred init > null
  const catchupStatus = fetchedCatchup ?? initCatchupStatus ?? null;

  // ── Fallback: if init data never arrives, fetch directly ───────

  useEffect(() => {
    if (!authValid || !userId) return;

    const timeoutId = setTimeout(async () => {
      if (!availability) {
        logger.info('Init data timeout — fetching eligibility directly');
        try {
          const avail = await api.canAnswerQuestion(userId);
          setFetchedAvailability({ canAnswer: avail.canAnswer, todayET: avail.todayET });
        } catch (err) {
          logger.error('Fallback eligibility fetch failed:', err);
        }
        try {
          const status = await api.getCatchupStatus(userId);
          setFetchedCatchup(status);
        } catch (err) {
          logger.error('Fallback catchup fetch failed:', err);
        }
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [authValid, userId, availability]);

  // ── Refresh from backend ───────────────────────────────────────

  const refreshUserStatus = useCallback(async () => {
    if (!userId) return;
    try {
      cacheService.invalidatePattern(`user_${userId}`);
      cacheService.invalidatePattern(`questions_${userId}`);

      const [avail, status] = await Promise.all([
        api.canAnswerQuestion(userId),
        api.getCatchupStatus(userId),
      ]);
      setFetchedAvailability({ canAnswer: avail.canAnswer, todayET: avail.todayET });
      setFetchedCatchup(status);
      setAnsweredThisSession(false); // Reset — trust backend
    } catch (error) {
      logger.error('Error refreshing user status:', error);
    }
  }, [userId]);

  // ── Answer result (optimistic update + background refresh) ─────

  const setAnswerResult = useCallback(
    (
      result: { correct: boolean; streak: number; pointsEarned?: number },
      question?: Question,
      selected?: string,
    ) => {
      setTodayResult(result);
      if (question) {
        setLastQuestion(question);
        setLastAnswer(selected || null);
      }
      setAnsweredThisSession(true);

      // Background refresh catchup from backend
      if (userId) {
        api.getCatchupStatus(userId)
          .then(status => setFetchedCatchup(status))
          .catch(err => logger.error('Error refreshing catchup after answer:', err));
      }
    },
    [userId],
  );

  const clearTodayResult = useCallback(() => {
    setTodayResult(null);
    setLastQuestion(null);
    setLastAnswer(null);
    setAnsweredThisSession(false);

    // Re-fetch from backend
    if (userId && authValid) {
      api.canAnswerQuestion(userId)
        .then(avail => setFetchedAvailability({ canAnswer: avail.canAnswer, todayET: avail.todayET }))
        .catch(err => logger.error('Error refreshing after clear:', err));
    }
  }, [userId, authValid]);

  const updateCatchupStatus = useCallback((status: CatchupStatus) => {
    setFetchedCatchup(status);
  }, []);

  const shouldShowQuestionStatus = useCallback(() => {
    return !catchupStatus || catchupStatus.questionsBehind <= 0;
  }, [catchupStatus]);

  // ── Context value ──────────────────────────────────────────────

  const value = useMemo<UserStatusContextType>(() => ({
    loading,
    hasAnsweredToday,
    canAnswerQuestion,
    catchupStatus,
    todayET,
    todayResult,
    lastQuestion,
    lastAnswer,
    loadingCatchup: loading,
    refreshUserStatus,
    clearTodayResult,
    updateCatchupStatus,
    setAnswerResult,
    shouldShowQuestionStatus,
  }), [
    loading, hasAnsweredToday, canAnswerQuestion, catchupStatus, todayET,
    todayResult, lastQuestion, lastAnswer,
    refreshUserStatus, clearTodayResult, updateCatchupStatus, setAnswerResult, shouldShowQuestionStatus,
  ]);

  return <UserStatusContext.Provider value={value}>{children}</UserStatusContext.Provider>;
};

export const useUserStatus = (): UserStatusContextType => {
  const context = useContext(UserStatusContext);
  if (context === undefined) {
    throw new Error('useUserStatus must be used within a UserStatusProvider');
  }
  return context;
};
