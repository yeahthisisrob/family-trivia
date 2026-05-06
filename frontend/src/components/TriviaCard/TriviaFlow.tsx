// File: src/components/TriviaCard/TriviaFlow.tsx
//
// Trivia question flow — carousel's active card.
// States: idle → generating → answering → result → done
// Catch-up first, then today's question.
//
// IMPORTANT: Once mounted, local state drives everything.
// Context is read only at init — we never let context changes
// reset an in-progress flow (answering, result, etc.).


import { GAME_MODES , getSecondsElapsedTodayET } from '@family-trivia/shared';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarsIcon from '@mui/icons-material/Stars';
import {
  Box, Button, Card, Chip, Typography,
  alpha, keyframes, useTheme,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CasinoRush } from './CasinoRush';
import CategorySelect from './CategorySelect';
import CurlingGame from './CurlingGame';
import DifficultySelect, { Difficulty } from './DifficultySelect';
import HistoryCard from './HistoryCard';
import SlotMachine from './SlotMachine';
import TetrisGame from './TetrisGame';
import { submitAnswer } from '../../api';
import { Question, generateQuestionStepped, getCatchupStatus } from '../../api/modules/trivia';
import { getUserProfile, CategorySelection, QuestionHistory } from '../../api/modules/user';
import appStrings from '../../constants/strings';
import { useTimeline } from '../../contexts/TimelineContext';
import { useTrivia } from '../../contexts/TriviaContext';
import { useTriviaFlowDispatch } from '../../contexts/TriviaFlowContext';
import { useUserStatus } from '../../contexts/UserStatusContext';
import { colors } from '../../shared/design-system/tokens/colors';
import { motion } from '../../shared/design-system/tokens/motion';
import { radii } from '../../shared/design-system/tokens/radii';
import { shadows } from '../../shared/design-system/tokens/shadows';
import { getUserColor, getUserInitials } from '../../utils';
import { isCustomCategory } from '../../utils/categoryUtils';
import { createLogger } from '../../utils/logger';
import CommentsThread from '../common/CommentsThread';
import CustomCategoryForm from '../CustomCategoryForm';
import { LoadingDots } from '../ui/feedback';

import type { CustomCategory } from '../../api';
import type { GameModeId } from '@family-trivia/shared';

const logger = createLogger('TriviaFlow');

const fadeSlideIn = keyframes`
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const iconPop = keyframes`
  0%   { transform: scale(1); }
  50%  { transform: scale(1.25); }
  100% { transform: scale(1); }
`;

const correctGlow = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.5); }
  70%  { box-shadow: 0 0 0 12px rgba(76, 175, 80, 0); }
  100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
`;

const headerShake = keyframes`
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-4px); }
  75%      { transform: translateX(4px); }
`;

const messageFadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// ── Types ─────────────────────────────────────────────────────────

type FlowState = 'idle' | 'difficulty' | 'generating' | 'answering' | 'result' | 'done';

export interface TriviaFlowProps {
  userId: string;
  groupId: string;
  onAnswerResult?: (result: AnswerResult, question?: Question, selectedAnswer?: string | null) => void;
  forceDisabled?: boolean;
  /** Test-only: inject mock history to bypass getUserProfile API */
  __mockHistory?: QuestionHistory | null;
}

interface AnswerResult {
  correct: boolean;
  streak: number;
  pointsEarned?: number;
}

// ── Fallback progress messages (used only when step pipeline fails) ──

const FALLBACK_PROGRESS = 'Generating your question...';

// ── Tiny count-up animation for points ────────────────────────────

const useCountUp = (target: number, duration = 600) => {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (target <= 0) return;
    const start = globalThis.performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    // Start from 0 via RAF (not setState directly in effect)
    raf = requestAnimationFrame((now) => { setValue(0); tick(now); });
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
};

const PointsChip: React.FC<{ points: number }> = ({ points }) => {
  const n = useCountUp(points);
  return (
    <Chip icon={<StarsIcon sx={{ fontSize: '13px !important' }} />}
      label={`+${n} pts`} color="primary" size="small"
      sx={{ height: 22, fontWeight: 600, fontSize: '0.68rem' }} />
  );
};

// ── Component ─────────────────────────────────────────────────────

const TriviaFlow: React.FC<TriviaFlowProps> = ({ userId, groupId, onAnswerResult, forceDisabled = false, __mockHistory }) => {
  const theme = useTheme();
  const { refreshTimestamp, invalidateCategories, refreshAllStatuses } = useTrivia();
  const { refreshTimeline } = useTimeline();
  const flowDispatch = useTriviaFlowDispatch();

  // Context — derived state from UserStatusContext (mirrors backend).
  // loading=true until eligibility data is ready.
  const { catchupStatus: ctxCatchup, loading: ctxLoading, hasAnsweredToday } = useUserStatus();

  // ── Local state (drives the flow once initialized) ─────────────

  const initRef = useRef(false);
  const [state, setState] = useState<FlowState>('idle');
  const [catchingUp, setCatchingUp] = useState(false);
  const [catchupBehind, setCatchupBehind] = useState(0);

  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [answerTimestamp, setAnswerTimestamp] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [categorySelections, setCategorySelections] = useState<CategorySelection[]>([]);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [latestHistory, setLatestHistory] = useState<QuestionHistory | null>(null);
  // Active game mode (null = none). Driven by the GAME_MODES registry.
  const [activeGameMode, setActiveGameMode] = useState<GameModeId | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);

  // Lookup: label → id for routing category selections to game modes
  const gameModeByLabel = useMemo(() => {
    const map = new Map<string, GameModeId>();
    for (const m of GAME_MODES) map.set(m.label, m.id);
    return map;
  }, []);
  const [createdCategory, setCreatedCategory] = useState('');

  // Tracks whether today's daily question has been used up.
  // One-way latch: once true, never goes back to false within this mount.
  const [dailyUsed, setDailyUsed] = useState(false);
  const markDailyUsed = useCallback(() => setDailyUsed(true), []);

  const containerRef = useRef<HTMLDivElement>(null);

  // Publish flow state to TriviaFlowContext so siblings can react
  useEffect(() => {
    flowDispatch.setFlowState(state as any);
  }, [state, flowDispatch]);

  useEffect(() => {
    flowDispatch.setActiveGameMode(activeGameMode);
  }, [activeGameMode, flowDispatch]);

  // Initialize flow state once context data is ready.
  // Runs once (initRef guard). Context provides correct derived state —
  // no timing issues since loading=true until data arrives.
  useEffect(() => {
    if (initRef.current || ctxLoading) return;
    initRef.current = true;

    const behind = ctxCatchup?.questionsBehind ?? 0;

    if (hasAnsweredToday) {
      setDailyUsed(true);
      if (behind <= 0) {
        setState('done');
        return;
      }
    }

    if (behind > 0) {
      setCatchingUp(true);
      setCatchupBehind(behind);
    }
  }, [ctxLoading, hasAnsweredToday, ctxCatchup]);

  // Handle late-arriving catchup data (deferred init).
  // If we already initialized but catchup wasn't available yet, update now.
  useEffect(() => {
    if (!initRef.current || !ctxCatchup) return;
    const behind = ctxCatchup.questionsBehind;
    if (behind > 0 && !catchingUp && state === 'idle') {
      setCatchingUp(true);
      setCatchupBehind(behind);
    }
  }, [ctxCatchup, catchingUp, state]);

  // Countdown for "next question" (used in done / final-result state)
  const calcCountdown = useCallback(() => {
    const remaining = 24 * 60 * 60 - getSecondsElapsedTodayET();
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }, []);
  const [countdown, setCountdown] = useState(calcCountdown);
  useEffect(() => {
    const id = setInterval(() => setCountdown(calcCountdown()), 30_000);
    return () => clearInterval(id);
  }, [calcCountdown]);

  // No scrollIntoView needed — the carousel owns the layout and ensures
  // TriviaFlow is visible when active (history cards hidden, full width).

  // ── Load profile for category history ───────────────────────────

  useEffect(() => {
    if (forceDisabled) return;
    // If mock data provided (Storybook), skip API call
    if (__mockHistory !== undefined) {
      setLatestHistory(__mockHistory);
      setProfileLoaded(true);
      return;
    }
    let mounted = true;
    getUserProfile(userId).then(p => {
      if (mounted) {
        setCategorySelections(p.categorySelections || []);
        const entries = (p.history || []).filter(h => h.question && h.selectedAnswer);
        setLatestHistory(entries.length ? entries[0] : null);
        setProfileLoaded(true);
      }
    }).catch(() => setProfileLoaded(true));
    return () => { mounted = false; };
  }, [userId, forceDisabled, refreshTimestamp, __mockHistory]);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await getUserProfile(userId);
      setCategorySelections(p.categorySelections || []);
      const entries = (p.history || []).filter(h => h.question && h.selectedAnswer);
      setLatestHistory(entries.length ? entries[0] : null);
      invalidateCategories();
      refreshTimeline(true);
      // Bust game-mode eligibility cache so CR/SM canPlay reflects the
      // new daily-limit state after any answer submission.
      refreshAllStatuses(userId);
    } catch { /* */ }
  }, [userId, invalidateCategories, refreshTimeline, refreshAllStatuses]);

  // ── Derived: is this the final result (no more questions)? ──────

  // isFinalResult is ONLY true in the 'done' state — never on the result screen.
  // The result screen always shows a button (Done / Next Question) to proceed.
  const isFinalResult = state === 'done';

  // What does the "next" button say?
  const nextButtonLabel = useMemo(() => {
    if (state !== 'result') return null;
    if (catchingUp && catchupBehind > 0) return 'Next Question';
    if (catchingUp && catchupBehind <= 0 && !dailyUsed) return 'Next — Today\'s Question';
    return 'Done';
  }, [state, catchingUp, catchupBehind, dailyUsed]);

  // ── Generate question (single API call) ─────────────────────────

  const handleCategorySelect = useCallback((cat: string) => {
    const modeId = gameModeByLabel.get(cat);
    if (modeId) { setActiveGameMode(modeId); return; }
    setPendingCategory(cat);
    setState('difficulty');
  }, [gameModeByLabel]);

  const handleDifficultySelect = useCallback((difficulty: Difficulty) => {
    if (!pendingCategory) return;
    generate(pendingCategory, difficulty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCategory, catchingUp, userId]);

  const handleDifficultyBack = useCallback(() => {
    setPendingCategory(null);
    setState('idle');
  }, []);

  const generate = async (category: string, difficulty: Difficulty) => {
    setState('generating');
    setQuestion(null); setSelected(null); setResult(null); setErrorMsg('');
    setProgressMsg(FALLBACK_PROGRESS);

    try {
      const mode = isCustomCategory(category) ? 'custom' : 'category';

      const q = await generateQuestionStepped(
        userId, mode, category, difficulty, catchingUp,
        (progress) => setProgressMsg(progress.message),
      );

      if (!q?.question || !q?.choices?.length || !q?.answer) {
        logger.error('Invalid question from step pipeline', { q });
        setErrorMsg('Invalid question received. Try another category.');
        setState('idle');
        return;
      }

      setQuestion(q);
      setState('answering');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const statusCode = (err as any)?.statusCode;

      // 403 means eligibility check failed — user is out of questions
      const isOutOfQuestions =
        statusCode === 403 ||
        msg.includes('Daily question limit') ||
        msg.includes('Daily limit') ||
        msg.includes('already answered') ||
        msg.includes('No catch-up') ||
        msg.includes('Season has ended');

      if (isOutOfQuestions) {
        logger.info('Out of questions — transitioning to done', { statusCode, msg });
        markDailyUsed();
        setState('done');
        refreshProfile();
      } else {
        logger.error('Question generation failed', { error: msg, statusCode });
        setErrorMsg(msg || 'Failed to generate question.');
        setState('idle');
      }
    }
  };

  // ── Submit answer ───────────────────────────────────────────────

  const handleAnswer = async (choice: string) => {
    if (!question) return;
    setSelected(choice);

    try {
      const isCustomCat = question.category ? isCustomCategory(question.category) : false;
      const res = await submitAnswer(userId, groupId, question, choice, catchingUp, isCustomCat);
      const answerRes: AnswerResult = { correct: res.correct, streak: res.streak, pointsEarned: res.pointsEarned };

      setResult(answerRes);
      setAnswerTimestamp(new Date().toISOString());
      setState('result');

      if (question.category) {
        setCategorySelections(prev => [...prev, { category: question.category || '', timestamp: new Date().toISOString(), isCustom: isCustomCat }]);
      }

      if (catchingUp) {
        // Update catch-up count — don't touch context (avoids re-render cascade)
        try {
          const fresh = await getCatchupStatus(userId);
          setCatchupBehind(fresh.questionsBehind);
        } catch {
          setCatchupBehind(prev => Math.max(0, prev - 1));
        }
      } else {
        // Daily question answered — mark locally, notify parent
        markDailyUsed();
        onAnswerResult?.(answerRes, question, choice);
      }
    } catch (err) {
      logger.error('Error submitting answer:', err);
      setErrorMsg(appStrings.errorSubmittingAnswer);
    }
  };

  // ── Next question / Done ────────────────────────────────────────

  const handleNext = useCallback(async () => {
    if (catchingUp && catchupBehind <= 0) {
      // Finished catch-up → move to today's question (or done if already used)
      setCatchingUp(false);
      if (dailyUsed) {
        setState('done');
      } else {
        setState('idle');
      }
      refreshProfile();
      return;
    }

    if (catchingUp && catchupBehind > 0) {
      // More catch-up questions
      setState('idle');
      invalidateCategories();
      return;
    }

    // Non-catchup → daily question done. Go straight to done.
    // Don't re-check catch-up status here — the backend cache may still
    // have stale data from before this answer was recorded, which would
    // incorrectly show questions behind and loop the user back to idle.
    markDailyUsed();
    setState('done');
    refreshProfile();
  }, [catchingUp, catchupBehind, dailyUsed, userId, refreshProfile, invalidateCategories, markDailyUsed]);

  // ── Game modes ──────────────────────────────────────────────────

  const handleGameComplete = useCallback(async (pts: number) => {
    setActiveGameMode(null);

    if (catchingUp) {
      let newBehind = catchupBehind;
      try {
        const fresh = await getCatchupStatus(userId);
        newBehind = fresh.questionsBehind;
        setCatchupBehind(newBehind);
      } catch {
        newBehind = Math.max(0, catchupBehind - 1);
        setCatchupBehind(newBehind);
      }
      if (newBehind <= 0) {
        setCatchingUp(false);
        if (dailyUsed) { setState('done'); } else { setState('idle'); }
      } else {
        setState('idle');
      }
    } else {
      // Non-catchup game mode done — go straight to done.
      markDailyUsed();
      setState('done');
    }

    refreshProfile();
    onAnswerResult?.({ correct: true, streak: 0, pointsEarned: pts });
  }, [catchingUp, catchupBehind, dailyUsed, userId, refreshProfile, onAnswerResult, markDailyUsed, invalidateCategories]);

  const handleGameClose = useCallback(() => {
    setActiveGameMode(null);
    setState(dailyUsed ? 'done' : 'idle');
  }, [dailyUsed]);

  // ── Render ──────────────────────────────────────────────────────

  if (forceDisabled) return null;

  // Game mode render — driven by registry, styled per mode
  const GAME_MODE_STYLES: Record<GameModeId, { border: string; borderTop: string; glow: string }> = {
    'casino-rush': {
      border: `2px solid ${alpha(colors.casinoRush.accent, 0.5)}`,
      borderTop: `3px solid ${colors.casinoRush.accent}`,
      glow: `0 0 20px ${alpha(colors.casinoRush.accent, 0.15)}, ${shadows.card}`,
    },
    'slot-machine': {
      border: `2px solid ${alpha(colors.casinoRush.gold, 0.4)}`,
      borderTop: `3px solid ${colors.casinoRush.gold}`,
      glow: `0 0 20px ${alpha(colors.casinoRush.gold, 0.12)}, ${shadows.card}`,
    },
    'curling': {
      border: `2px solid ${alpha('#64b5f6', 0.5)}`,
      borderTop: `3px solid #1976d2`,
      glow: `0 0 20px ${alpha('#64b5f6', 0.15)}, ${shadows.card}`,
    },
    'tetris': {
      border: `2px solid ${alpha('#9c27b0', 0.5)}`,
      borderTop: `3px solid #7b1fa2`,
      glow: `0 0 20px ${alpha('#9c27b0', 0.15)}, ${shadows.card}`,
    },
  };

  const GAME_MODE_COMPONENTS: Record<GameModeId, React.ReactNode> = {
    'casino-rush': <CasinoRush userId={userId} onComplete={handleGameComplete} onClose={handleGameClose} isCatchingUp={catchingUp} />,
    'slot-machine': <SlotMachine userId={userId} groupId={groupId} onComplete={handleGameComplete} onClose={handleGameClose} isCatchingUp={catchingUp} />,
    'curling': <CurlingGame userId={userId} isCatchingUp={catchingUp} onComplete={(points) => handleGameComplete(points)} onClose={handleGameClose} />,
    'tetris': <TetrisGame userId={userId} isCatchingUp={catchingUp} onComplete={(result) => handleGameComplete(result.pointsEarned)} onClose={handleGameClose} />,
  };

  if (activeGameMode) {
    const style = GAME_MODE_STYLES[activeGameMode];
    return (
      <Box sx={{
        borderRadius: `${radii.xl}px`,
        border: style.border,
        borderTop: style.borderTop,
        boxShadow: style.glow,
        overflow: 'hidden',
      }}>
        {GAME_MODE_COMPONENTS[activeGameMode]}
      </Box>
    );
  }
  if (showCustomForm) {
    return (
      <CustomCategoryForm open onClose={() => { setShowCustomForm(false); }}
        onSuccess={(cat: CustomCategory) => { setShowCustomForm(false); setCreatedCategory(cat.title); invalidateCategories(); }} />
    );
  }

  // Gate on initial loading — never when flow is active
  if (ctxLoading && state === 'idle' && !initRef.current) return <LoadingDots mt={2} />;

  // ── Done: no more questions — show last answer + countdown ─────

  if (state === 'done') {
    if (!profileLoaded) return <LoadingDots mt={2} />;
    if (!latestHistory) {
      // No history yet — fall back to viewOnly category grid
      return (
        <CategorySelect onSelect={() => {}} recentSelections={categorySelections} viewOnly
          onCreateCustomCategory={() => setShowCustomForm(true)} />
      );
    }
    return (
      <Box>
        {/* Countdown banner above card */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
          mb: 1, py: 0.6, px: 2, borderRadius: `${radii.md}px`,
          bgcolor: alpha(colors.brand.primary, 0.05),
          border: `1px solid ${alpha(colors.brand.primary, 0.12)}`,
        }}>
          <AccessTimeIcon sx={{ fontSize: 15, color: colors.text.secondary }} />
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: colors.text.secondary }}>
            Next question in {countdown}
          </Typography>
        </Box>
        <HistoryCard
          userId={userId}
          question={latestHistory.question?.question || ''}
          choices={latestHistory.question?.choices || []}
          answer={latestHistory.question?.answer || ''}
          selectedAnswer={latestHistory.selectedAnswer || ''}
          correct={latestHistory.correct}
          category={latestHistory.question?.category}
          pointsEarned={latestHistory.pointsEarned}
          timestamp={latestHistory.timestamp}
        />
      </Box>
    );
  }

  // ── Active states ───────────────────────────────────────────────

  return (
    <Box ref={containerRef}>
      {/* Error banner */}
      {errorMsg && (
        <Box sx={{ mb: 1.5, p: 1.5, borderRadius: `${radii.md}px`, bgcolor: alpha(colors.result.incorrect, 0.08),
          border: `1px solid ${alpha(colors.result.incorrect, 0.2)}` }}>
          <Typography sx={{ fontSize: '0.8rem', color: colors.result.incorrect }}>{errorMsg}</Typography>
        </Box>
      )}

      {/* Created category feedback */}
      {createdCategory && (
        <Box sx={{ mb: 1.5, p: 1, borderRadius: `${radii.md}px`, bgcolor: alpha(colors.category.custom, 0.08),
          border: `1px solid ${alpha(colors.category.custom, 0.15)}`, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.75rem', color: colors.category.custom, fontWeight: 600 }}>
            Created: {createdCategory}
          </Typography>
        </Box>
      )}

      {/* IDLE: show category grid — viewOnly if daily used (unless catching up) OR context still loading */}
      {state === 'idle' && (
        profileLoaded ? (
          <CategorySelect
            onSelect={handleCategorySelect}
            recentSelections={categorySelections}
            isCatchingUp={catchingUp}
            catchupBehind={catchupBehind}
            viewOnly={(dailyUsed && !catchingUp) || (!initRef.current && ctxLoading)}
            onCreateCustomCategory={() => setShowCustomForm(true)}
          />
        ) : <LoadingDots mt={2} />
      )}

      {/* DIFFICULTY: pick easy/normal/hard */}
      {state === 'difficulty' && pendingCategory && (
        <Box sx={{ animation: `${fadeSlideIn} ${motion.duration.normal} ${motion.ease.bounce}` }}>
          <DifficultySelect
            category={pendingCategory}
            onSelect={handleDifficultySelect}
            onBack={handleDifficultyBack}
          />
        </Box>
      )}

      {/* GENERATING: inline progress */}
      {state === 'generating' && (
        <Card sx={{
          overflow: 'hidden', borderRadius: `${radii.xl}px`,
          boxShadow: shadows.card,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          animation: `${fadeSlideIn} ${motion.duration.normal} ${motion.ease.bounce}`,
        }}>
          <Box sx={{ p: 2.5, textAlign: 'center' }}>
            {/* Keyed by message so each swap fades in */}
            <Typography
              key={progressMsg}
              sx={{
                fontSize: '0.82rem', color: colors.text.secondary, mb: 1,
                animation: `${messageFadeIn} ${motion.duration.normal} ${motion.ease.smooth}`,
              }}
            >
              {progressMsg}
            </Typography>
            <LoadingDots mt={0} />
          </Box>
        </Card>
      )}

      {/* ANSWERING + RESULT: question card with inline result */}
      {(state === 'answering' || state === 'result') && question && (() => {
        const resultAccent = state === 'result'
          ? (result?.correct ? colors.result.correct : colors.result.incorrect)
          : colors.brand.primary;
        return (
        <>
        {/* Countdown banner when this is the final result */}
        {isFinalResult && (
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
            mb: 1, py: 0.6, px: 2, borderRadius: `${radii.md}px`,
            bgcolor: alpha(colors.brand.primary, 0.05),
            border: `1px solid ${alpha(colors.brand.primary, 0.12)}`,
          }}>
            <AccessTimeIcon sx={{ fontSize: 15, color: colors.text.secondary }} />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: colors.text.secondary }}>
              Next question in {countdown}
            </Typography>
          </Box>
        )}

        <Card sx={{
          overflow: 'hidden', borderRadius: `${radii.xl}px`,
          boxShadow: shadows.card,
          border: `1px solid ${alpha(resultAccent, 0.15)}`,
          borderTop: state === 'result' ? `3px solid ${alpha(resultAccent, 0.6)}` : undefined,
          // Entrance on first render; glow pulse on correct answer
          animation: state === 'answering'
            ? `${fadeSlideIn} ${motion.duration.normal} ${motion.ease.bounce}`
            : state === 'result' && result?.correct
              ? `${correctGlow} 800ms ${motion.ease.smooth}`
              : undefined,
        }}>
          {/* Card header — shakes on incorrect */}
          <Box sx={{
            px: 1.5, py: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: state === 'result'
              ? `linear-gradient(135deg, ${alpha(resultAccent, 0.07)}, transparent)`
              : `linear-gradient(135deg, ${alpha(colors.brand.primary, 0.06)}, transparent)`,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            animation: state === 'result' && result && !result.correct
              ? `${headerShake} 300ms ${motion.ease.snappy}`
              : undefined,
          }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: state === 'result' ? resultAccent : undefined }}>
              {state === 'result' ? (result?.correct ? 'Correct!' : 'Not quite') : 'Your Question'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {question.category && (
                <Chip label={question.category} size="small" variant="outlined"
                  sx={{ height: 20, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.75 } }} />
              )}
            </Box>
          </Box>

          <Box sx={{ px: 1.5, py: 1.25 }}>
            {/* Question text */}
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 500, lineHeight: 1.45, mb: 1.25, textAlign: 'center' }}>
              {question.question}
            </Typography>

            {/* Answer choices — highlight after answering */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {question.choices.map(choice => {
                const isSelected = selected === choice;
                const isCorrect = question.answer === choice;
                const answered = state === 'result';

                let bgcolor = 'transparent';
                let borderColor = alpha(theme.palette.divider, 0.15);
                let fontWeight = 500;

                if (answered) {
                  if (isCorrect) {
                    bgcolor = alpha(colors.result.correct, 0.08);
                    borderColor = alpha(colors.result.correct, 0.4);
                    fontWeight = 600;
                  } else if (isSelected && !result?.correct) {
                    bgcolor = alpha(colors.result.incorrect, 0.06);
                    borderColor = alpha(colors.result.incorrect, 0.35);
                  }
                } else if (isSelected) {
                  bgcolor = alpha(colors.brand.primary, 0.08);
                  borderColor = colors.brand.primary;
                }

                return (
                  <Box
                    key={choice}
                    onClick={() => !selected && handleAnswer(choice)}
                    sx={{
                      py: 0.75, px: 1.25,
                      borderRadius: `${radii.md}px`,
                      border: `1.5px solid ${borderColor}`,
                      bgcolor,
                      cursor: selected ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'all 0.15s',
                      ...(!selected && {
                        // Only apply hover on pointer devices (not touch) — prevents
                        // sticky :hover on mobile after tapping through screens
                        '@media (hover: hover)': {
                          '&:hover': { bgcolor: alpha(colors.brand.primary, 0.04), borderColor: colors.brand.primary },
                        },
                        '&:active': { transform: 'scale(0.98)' },
                      }),
                      minHeight: 40,
                    }}
                  >
                    <Typography sx={{ fontSize: '0.82rem', fontWeight, lineHeight: 1.3, flex: 1 }}>
                      {choice}
                    </Typography>
                    {answered && isCorrect && (
                      <CheckCircleIcon sx={{
                        color: colors.result.correct, fontSize: 18, ml: 0.75, flexShrink: 0,
                        animation: `${iconPop} 400ms ${motion.ease.bounce}`,
                      }} />
                    )}
                    {answered && isSelected && !result?.correct && (
                      <CancelIcon sx={{
                        color: colors.result.incorrect, fontSize: 18, ml: 0.75, flexShrink: 0,
                        animation: `${iconPop} 400ms ${motion.ease.bounce}`,
                      }} />
                    )}
                  </Box>
                );
              })}
            </Box>

            {/* Result banner + actions */}
            {state === 'result' && result && (
              <Box sx={{ mt: 1.5 }}>
                {/* Points + streak chips */}
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, mb: 1.25 }}>
                  {result.streak > 0 && (
                    <Chip icon={<EmojiEventsIcon sx={{ fontSize: '13px !important' }} />}
                      label={`${result.streak} streak`} color="success" size="small"
                      sx={{ height: 22, fontWeight: 600, fontSize: '0.68rem' }} />
                  )}
                  {(result.pointsEarned ?? 0) > 0 && result.correct && (
                    <PointsChip points={result.pointsEarned ?? 0} />
                  )}
                </Box>

                {/* Inline comment */}
                {answerTimestamp && (
                  <Box sx={{
                    mt: 1.25, pt: 1.25,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                  }}>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: colors.text.disabled, mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Comment
                    </Typography>
                    <CommentsThread
                      contentId={`${userId}_${answerTimestamp}`}
                      contentType="trivia"
                      currentUserId={userId}
                      getUserColor={getUserColor}
                      getUserInitials={getUserInitials}
                      textOverrides={{ placeholderText: 'That was a tough one...' }}
                    />
                  </Box>
                )}

                {/* Next button — hidden on final result (user stays on result card) */}
                {nextButtonLabel && (
                  <Button
                    variant="contained"
                    color={result.correct ? 'success' : 'primary'}
                    fullWidth
                    onClick={handleNext}
                    sx={{ mt: 1.5, py: 0.85, borderRadius: `${radii.md}px`, fontWeight: 600, fontSize: '0.82rem' }}
                  >
                    {nextButtonLabel}
                  </Button>
                )}
              </Box>
            )}
          </Box>
        </Card>
        </>
        );
      })()}
    </Box>
  );
};

export default TriviaFlow;
