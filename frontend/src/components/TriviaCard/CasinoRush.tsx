// File: src/components/TriviaCard/CasinoRush.tsx

import MoveToNextIcon from '@mui/icons-material/ArrowForward';
import CasinoIcon from '@mui/icons-material/Casino';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import TimerIcon from '@mui/icons-material/Timer';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Typography,
  useTheme,
  alpha,
  keyframes,
} from '@mui/material';
import React, { useState, useEffect, useRef, useCallback } from 'react';

import CasinoRushProgress from './CasinoRushProgress';
import {
  startCasinoRush,
  submitCasinoRushAnswer,
  type CasinoRushSession,
  type CasinoRushResult,
} from '../../api/modules/games';
import { ProgressMessage } from '../../api/modules/trivia';
import { useTrivia } from '../../contexts/TriviaContext';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

const logger = createLogger('CasinoRush');

interface CasinoRushProps {
  userId: string;
  onComplete?: (points: number) => void;
  onClose: () => void;
  isCatchingUp?: boolean;
}

export const CasinoRush: React.FC<CasinoRushProps> = ({ userId, onComplete, onClose, isCatchingUp = false }) => {
  const theme = useTheme();
  const timerRef = useRef<number | null>(null);

  // Use our new context hook without automatic polling
  const { casinoRush, refreshCasinoRushStatus } = useTrivia();

  // Destructure the values from the context
  const { canPlay, nextAvailable, hasActiveSession, loading: statusLoading } = casinoRush;

  // Explicit refresh function for when we need to refresh status
  const refresh = useCallback(() => {
    if (userId) {
      return refreshCasinoRushStatus(userId);
    }
    return Promise.resolve();
  }, [userId, refreshCasinoRushStatus]);

  // Status is already loaded by CategorySelect — no need to refresh on mount

  const [session, setSession] = useState<CasinoRushSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<CasinoRushResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [showStartDialog, setShowStartDialog] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [progressMessages, setProgressMessages] = useState<ProgressMessage[]>([]);
  const [showGenerationDialog, setShowGenerationDialog] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);

  // Define animation keyframes
  const spinDice = keyframes`
    0% { transform: rotateY(0deg) rotateX(0deg); }
    25% { transform: rotateY(180deg) rotateX(90deg); }
    50% { transform: rotateY(360deg) rotateX(180deg); }
    75% { transform: rotateY(180deg) rotateX(270deg); }
    100% { transform: rotateY(0deg) rotateX(360deg); }
  `;

  const fadeIn = keyframes`
    0% { opacity: 0; transform: scale(0.9); }
    100% { opacity: 1; transform: scale(1); }
  `;

  const startGame = useCallback(
    async (selectedDifficulty?: 'easy' | 'normal' | 'hard') => {
      try {
        setLoading(true);
        setError(null);
        setShowStartDialog(false);

        logger.info('Starting Casino Rush game', { difficulty: selectedDifficulty || difficulty });
        const gameSession = await startCasinoRush(userId, selectedDifficulty || difficulty, true, isCatchingUp);

        if (!gameSession || !gameSession.currentQuestion) {
          throw new Error('Invalid session received from server');
        }

        const isResumed = (gameSession as any).resumed === true;

        if (isResumed) {
          // Resumed session — skip generation dialog, go straight to game.
          // Timer starts NOW because the question is about to be visible.
          logger.info('Resumed existing Casino Rush session');
          setSession(gameSession);
          setTimeRemaining(60);
          setShowGenerationDialog(false);
          setGeneratingQuestions(false);
        } else {
          // New session — show generation progress dialog.
          // Timer does NOT start yet — it starts when the dialog is dismissed
          // and the question becomes visible (via the timer effect's
          // !showGenerationDialog check).
          setProgressMessages(gameSession.messages || []);
          setShowGenerationDialog(true);
          setGeneratingQuestions(false);
          setSession(gameSession);
          // Don't set timeRemaining here — it stays at 60 from initial state,
          // and the timer effect won't run until showGenerationDialog is false.
        }

        refresh();
      } catch (err) {
        const error = err as Error;
        logger.error('Failed to start Casino Rush', {
          error: error.message,
          userId,
        });
        setGeneratingQuestions(false);
        setShowGenerationDialog(false);

        // Use errorType from backend if available
        const errorType = (error as any).errorType;
        if (errorType === 'COOLDOWN' || error.message?.includes('cooldown')) {
          setError('Casino Rush is on cooldown. You can play again next week!');
        } else {
          setError(error.message || 'Failed to start game. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    },
    [userId, difficulty, refresh, isCatchingUp],
  );

  const handleTimeExpired = useCallback(async () => {
    if (!session || result || selectedAnswer) return; // Don't process if answer already selected or no session or result already set

    try {
      const response = await submitCasinoRushAnswer(userId, '');
      setResult(response);
      setShowResult(true);
    } catch (err) {
      const error = err as Error;
      logger.error('Time expired error', {
        error: error.message,
        stack: error.stack,
        userId,
      });
      // Don't show UI error for time expiry - handle silently
    }
  }, [session, result, userId, selectedAnswer]);

  // Process initial status — only runs once when status first loads
  const statusProcessedRef = useRef(false);
  useEffect(() => {
    if (statusLoading || statusProcessedRef.current || session) return;

    statusProcessedRef.current = true;
    setLoading(false);

    if (hasActiveSession) {
      logger.info('Resuming active Casino Rush session');
      startGame();
    } else if (!canPlay) {
      logger.info('Casino Rush on cooldown');
      // Don't set error — the cooldown UI handles this via the render check below
    } else {
      setShowStartDialog(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusLoading]);

  // Timer effect — ONLY runs when the question is actually visible.
  // The generation dialog and loading states block the timer.
  useEffect(() => {
    if (session && !result && timeRemaining > 0 && !selectedAnswer && !showGenerationDialog && !loading) {
      timerRef.current = window.setTimeout(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            // Time's up!
            handleTimeExpired();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [session, result, timeRemaining, selectedAnswer, showGenerationDialog, loading, handleTimeExpired]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const handleAnswer = async (answer: string) => {
    if (selectedAnswer || !session) return;

    // Clear any active timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Mark answer as selected
    setSelectedAnswer(answer);

    try {
      // Submit answer to backend
      const response = await submitCasinoRushAnswer(userId, answer);

      // Show result
      setResult(response);
      setShowResult(true);

      if (response.gameOver) {
        // Handle game over - either win or loss
        if (response.complete && onComplete) {
          onComplete(response.earnedPoints);
        }

        // Update context state after game is over
        refresh();
      } else if (response.nextQuestion) {
        // Show transition animation then continue to next question
        setTimeout(() => {
          // Start transition animation
          setTransitioning(true);

          // After animation, update to next question
          setTimeout(() => {
            if (response.nextQuestion) {
              setSession({
                ...session,
                currentQuestion: response.nextQuestion,
              });
            }
            setSelectedAnswer(null);
            setResult(null);
            setShowResult(false);
            setTimeRemaining(60);
            setProgressMessages([]); // Clear progress messages for new question

            // End transition after a short delay to allow fade-in animation
            setTimeout(() => {
              setTransitioning(false);
            }, 300);
          }, 1200); // Main animation duration
        }, 800); // Shorter initial delay before transition
      }
    } catch (err) {
      const error = err as Error;
      logger.error('Failed to submit answer', {
        error: error.message,
        stack: error.stack,
        userId,
        answer,
      });
      if (
        error.message?.includes('empty response') ||
        error.message?.includes('invalid response')
      ) {
        setError('Unable to connect to the Casino Rush game server. Please try again later.');
      } else {
        setError('Failed to submit answer. Please try again.');
      }
      setSelectedAnswer(null); // Reset selection on error
    }
  };

  if (loading) {
    return <LoadingDots mt={4} />;
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
          <Button variant="outlined" onClick={onClose}>
            Close
          </Button>
          <Button variant="contained" onClick={() => { setError(null); statusProcessedRef.current = false; refresh(); }}>
            Try Again
          </Button>
        </Box>
      </Box>
    );
  }

  // Check if on cooldown
  if (!canPlay && !session) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CasinoIcon sx={{ fontSize: 80, color: theme.palette.action.disabled, mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Casino Rush on Cooldown
            </Typography>
            <Typography color="text.secondary" paragraph>
              You can play Casino Rush again{' '}
              {nextAvailable ? (
                <>
                  on {nextAvailable.toLocaleDateString()} at {nextAvailable.toLocaleTimeString()}
                </>
              ) : (
                'later'
              )}
              .
            </Typography>
            <Button onClick={onClose} variant="outlined">
              Close
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Start screen — inline card (no modal dialog)
  if (showStartDialog && !session) {
    return (
      <Card sx={{ overflow: 'hidden', borderRadius: 3 }}>
        {/* Header */}
        <Box sx={{
          background: `linear-gradient(45deg, ${theme.palette.error.dark} 30%, ${theme.palette.warning.dark} 90%)`,
          color: 'white', px: 2, py: 1.25,
          display: 'flex', alignItems: 'center', gap: 1,
        }}>
          <CasinoIcon sx={{ fontSize: 20 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', flex: 1 }}>Casino Rush</Typography>
          <Button onClick={onClose} size="small" sx={{ color: 'white', minWidth: 0, fontSize: '0.7rem' }}>Cancel</Button>
        </Box>

        <Box sx={{ p: 2 }}>
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <LocalFireDepartmentIcon sx={{ fontSize: 44, color: theme.palette.warning.main, mb: 1 }} />
            <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>Triple or Nothing!</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
              3 questions, 60s each — get one wrong and lose it all
            </Typography>
          </Box>

          {/* Difficulty */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary', mb: 0.75, textAlign: 'center' }}>
              Difficulty
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'center' }}>
              <Chip label="Easy 1.5×" size="small"
                color={difficulty === 'easy' ? 'success' : 'default'}
                onClick={() => setDifficulty('easy')}
                variant={difficulty === 'easy' ? 'filled' : 'outlined'}
                sx={{ fontSize: '0.7rem' }}
              />
              <Chip label="Normal 3×" size="small"
                color={difficulty === 'normal' ? 'primary' : 'default'}
                onClick={() => setDifficulty('normal')}
                variant={difficulty === 'normal' ? 'filled' : 'outlined'}
                sx={{ fontSize: '0.7rem' }}
              />
              <Chip label="Hard 6×" size="small"
                color={difficulty === 'hard' ? 'error' : 'default'}
                onClick={() => setDifficulty('hard')}
                variant={difficulty === 'hard' ? 'filled' : 'outlined'}
                sx={{ fontSize: '0.7rem' }}
              />
            </Box>
          </Box>

          <Button
            variant="contained" fullWidth
            onClick={() => startGame(difficulty)}
            startIcon={<CasinoIcon />}
            sx={{
              py: 1, fontWeight: 600, fontSize: '0.85rem',
              background: `linear-gradient(45deg, ${theme.palette.error.main} 30%, ${theme.palette.warning.main} 90%)`,
              borderRadius: 2,
            }}
          >
            Start Casino Rush
          </Button>
        </Box>
      </Card>
    );
  }

  // Generation progress — inline card (no modal dialog)
  if (showGenerationDialog) {
    return (
      <Card sx={{ overflow: 'hidden', borderRadius: 3 }}>
        <Box sx={{
          background: `linear-gradient(45deg, ${theme.palette.error.dark} 30%, ${theme.palette.warning.dark} 90%)`,
          color: 'white', px: 2, py: 1.25,
          display: 'flex', alignItems: 'center', gap: 1,
        }}>
          <CasinoIcon sx={{ fontSize: 20 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Preparing Casino Rush</Typography>
        </Box>
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <CasinoRushProgress messages={progressMessages} compact={false} />
          {!generatingQuestions && (
            <Button
              variant="contained" fullWidth
              onClick={() => { setTimeRemaining(60); setShowGenerationDialog(false); }}
              sx={{
                mt: 2, py: 1, fontWeight: 600,
                background: `linear-gradient(45deg, ${theme.palette.error.main} 30%, ${theme.palette.warning.main} 90%)`,
                borderRadius: 2,
              }}
            >
              Let's Play!
            </Button>
          )}
          {generatingQuestions && <LoadingDots mt={2} />}
        </Box>
      </Card>
    );
  }

  // Game screen
  if (session && !showResult) {
    const question = session.currentQuestion;

    // Guard against missing question data
    if (!question) {
      logger.error('No current question in session', { session });
      return (
        <Alert severity="error" sx={{ mb: 2 }}>
          Error: No question available. Please restart the game.
          <Button onClick={onClose} sx={{ ml: 2 }}>
            Close
          </Button>
        </Alert>
      );
    }

    const progress = ((60 - timeRemaining) / 60) * 100;

    return (
      <Card
        sx={{
          border: `2px solid ${theme.palette.warning.main}`,
          background: alpha(theme.palette.warning.main, 0.05),
          position: 'relative',
        }}
      >
        <CardContent>
          {/* Show progress messages if available */}
          {progressMessages.length > 0 && (
            <CasinoRushProgress messages={progressMessages} compact={true} />
          )}

          <Box sx={{ mb: 3 }}>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}
            >
              <Chip
                icon={<CasinoIcon />}
                label={`Question ${question.questionNumber || 1} of ${question.totalQuestions || 3}`}
                color="warning"
              />
              <Chip
                icon={<TimerIcon />}
                label={`${timeRemaining}s`}
                color={timeRemaining < 10 ? 'error' : 'primary'}
              />
            </Box>

            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ height: 8, borderRadius: 4 }}
              color={timeRemaining < 10 ? 'error' : 'primary'}
            />
          </Box>

          <Typography variant="h6" gutterBottom>
            {question.question}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 3 }}>
            {question.choices?.map((choice) => (
              <Button
                key={choice}
                variant={selectedAnswer === choice ? 'contained' : 'outlined'}
                onClick={() => handleAnswer(choice)}
                disabled={!!selectedAnswer}
                sx={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  py: 1.5,
                  textTransform: 'none',
                }}
              >
                {choice}
              </Button>
            ))}
          </Box>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Potential winnings: {session.potentialPoints} points
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Result screen
  if (showResult && result) {
    return (
      <Card
        sx={{
          border: `2px solid ${result.correct ? theme.palette.success.main : theme.palette.error.main}`,
          background: alpha(
            result.correct ? theme.palette.success.main : theme.palette.error.main,
            0.05,
          ),
          position: 'relative',
        }}
      >
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 3 }}>
            {result.gameOver && result.complete ? (
              <>
                <CasinoIcon sx={{ fontSize: 80, color: theme.palette.success.main, mb: 2 }} />
                <Typography variant="h4" gutterBottom color="success.main">
                  JACKPOT!
                </Typography>
                <Typography variant="h6" gutterBottom>
                  You won {result.earnedPoints} points!
                </Typography>
              </>
            ) : result.gameOver ? (
              <>
                <CasinoIcon sx={{ fontSize: 80, color: theme.palette.error.main, mb: 2 }} />
                <Typography variant="h4" gutterBottom color="error">
                  Game Over
                </Typography>
                <Typography variant="h6" gutterBottom>
                  {result.reason === 'time_expired'
                    ? 'Time ran out!'
                    : result.reason === 'wrong_answer'
                      ? 'Wrong answer!'
                      : 'Game over!'}
                </Typography>
                {result.correctAnswer && (
                  <Typography variant="body1" color="text.secondary">
                    Correct answer: {result.correctAnswer}
                  </Typography>
                )}
                <Typography variant="h6" sx={{ mt: 2 }}>
                  Points earned: 0
                </Typography>
              </>
            ) : transitioning ? (
              <Box
                sx={{
                  py: 2,
                  height: 150,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CasinoIcon
                  sx={{
                    fontSize: 80,
                    color: theme.palette.warning.main,
                    mb: 2,
                    animation: `${spinDice} 1.2s ease-in-out infinite`,
                    transformStyle: 'preserve-3d',
                    perspective: '1000px',
                  }}
                />
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    animation: `${fadeIn} 0.3s ease-out`,
                  }}
                >
                  <Typography variant="h6" color="text.secondary">
                    Next Question
                  </Typography>
                  <MoveToNextIcon sx={{ color: theme.palette.warning.main }} />
                </Box>
              </Box>
            ) : (
              <Box sx={{ animation: `${fadeIn} 0.5s ease-out` }}>
                <Typography variant="h5" color="success.main" gutterBottom>
                  Correct!
                </Typography>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}
                >
                  <Typography variant="body1">Next question loading</Typography>
                  <LoadingDots size={5} inline />
                </Box>
              </Box>
            )}
          </Box>

          {result.gameOver && (
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Button variant="contained" onClick={onClose} sx={{ minWidth: 200 }}>
                Close
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  }

  // Fallback — should not reach here
  return <LoadingDots mt={4} />;
};

export default CasinoRush;
