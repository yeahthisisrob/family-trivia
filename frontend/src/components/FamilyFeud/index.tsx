// File: src/components/FamilyFeud/index.tsx
// Family Feud round-robin game — shows on the home timeline as a highlighted card.

import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupsIcon from '@mui/icons-material/Groups';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import PersonIcon from '@mui/icons-material/Person';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import TimerIcon from '@mui/icons-material/Timer';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  LinearProgress,
  TextField,
  Typography,
  alpha,
  keyframes,
  useTheme,
} from '@mui/material';
import React, { useState, useEffect, useCallback } from 'react';

import {
  getFamilyFeudStatus,
  startFamilyFeudRound,
  submitFamilyFeudAnswer,
  submitFamilyFeudGuess,
  passFamilyFeudTurn,
  FamilyFeudStatus,
} from '../../api/modules/familyFeud';
import { useFamilyData } from '../../contexts/FamilyDataContext';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

const logger = createLogger('FamilyFeud');

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

interface FamilyFeudProps {
  userId: string;
}

const FamilyFeud: React.FC<FamilyFeudProps> = ({ userId }) => {
  const theme = useTheme();
  const [status, setStatus] = useState<FamilyFeudStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answer, setAnswer] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  // Hydrate from app-init first, then refresh from server (triggers expiry check)
  const { initFamilyFeud, appInitComplete } = useFamilyData();
  const refreshedRef = React.useRef(false);

  useEffect(() => {
    if (appInitComplete && initFamilyFeud && !status) {
      setStatus(initFamilyFeud as unknown as FamilyFeudStatus);
    }
  }, [appInitComplete, initFamilyFeud, status]);

  const refresh = useCallback(async () => {
    try {
      const data = await getFamilyFeudStatus(userId);
      setStatus(data);
    } catch (err) {
      logger.error('Failed to load Family Feud status', err);
    }
  }, [userId]);

  // Always refresh on mount — this triggers server-side expiry check
  useEffect(() => {
    if (appInitComplete && !refreshedRef.current) {
      refreshedRef.current = true;
      refresh();
    }
  }, [appInitComplete, refresh]);

  if (!status) return null;

  const { currentRound, isMyTurn } = status;

  // Helper: time remaining display
  const getTimeDisplay = (expiresAt: string) => {
    const ms = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const hours = Math.floor(ms / (1000 * 60 * 60));
    if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
    return `${hours}h left`;
  };

  // Helper: time ago
  const timeAgo = (dateStr: string) => {
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // ── NO ACTIVE ROUND — anyone can start (first come, first served) ──
  if (!currentRound && isMyTurn) {
    const neverGone = status.neverGone || 0;
    const totalPeople = status.totalPeople || 0;

    return (
      <Card sx={{
        mb: 2, overflow: 'hidden', borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        boxShadow: `0 2px 12px ${alpha('#000', 0.06)}`,
      }}>
        <Box sx={{
          px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1,
          background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.08)}, ${alpha(theme.palette.secondary.dark, 0.04)})`,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}>
          <GroupsIcon sx={{ fontSize: 20, color: theme.palette.secondary.main }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', flex: 1 }}>Family Feud</Typography>
          {status.timesAsTarget > 0 && (
            <Chip size="small" label={`You: ${status.timesAsTarget}x`} variant="outlined"
              sx={{ height: 20, fontSize: '0.6rem' }} />
          )}
        </Box>
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontSize: '0.82rem', mb: 1 }}>
            Be today's featured family member! Answer a personal question and see if your family can guess your answer.
          </Typography>
          {neverGone > 0 && (
            <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary, mb: 1.5 }}>
              {neverGone} of {totalPeople} family members haven't been featured yet.
            </Typography>
          )}
          {message && <Alert severity="info" sx={{ mb: 1, fontSize: '0.8rem' }}>{message}</Alert>}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" size="small" disabled={submitting}
              startIcon={submitting ? <LoadingDots size={4} inline /> : <GroupsIcon />}
              sx={{ bgcolor: theme.palette.secondary.main, '&:hover': { bgcolor: theme.palette.secondary.dark } }}
              onClick={async () => {
                setSubmitting(true); setMessage(null);
                try { await startFamilyFeudRound(userId); await refresh(); }
                catch { setMessage('Failed to start round.'); }
                finally { setSubmitting(false); }
              }}>
              {submitting ? 'Generating...' : "I'll Go!"}
            </Button>
            <Button variant="outlined" size="small" color="inherit" startIcon={<SkipNextIcon />}
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await passFamilyFeudTurn(userId);
                  setMessage('Passed! Someone else can start.');
                  await refresh();
                } catch { setMessage('Failed to pass.'); }
                finally { setSubmitting(false); }
              }}>
              Not Now
            </Button>
          </Box>
        </Box>
      </Card>
    );
  }

  // ── WAITING FOR TARGET TO ANSWER ──
  if (currentRound?.status === 'waiting_for_target') {
    if (currentRound.targetUserId === userId) {
      return (
        <Card sx={{          mb: 2, border: `2px solid ${theme.palette.info.main}`,
          background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)}, transparent)`,
        }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <GroupsIcon sx={{ color: theme.palette.info.main }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Answer Your Question!
              </Typography>
            </Box>
            <Box sx={{
              p: 2, mb: 2, borderRadius: 2, bgcolor: alpha(theme.palette.info.main, 0.08),
              borderLeft: `4px solid ${theme.palette.info.main}`,
            }}>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {currentRound.question}
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Be honest! Your family will try to guess your answer.
            </Typography>
            {message && <Alert severity="info" sx={{ mb: 1 }}>{message}</Alert>}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField size="small" fullWidth placeholder="Your honest answer..."
                value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={submitting} />
              <Button variant="contained" color="info" disabled={!answer.trim() || submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await submitFamilyFeudAnswer(userId, answer.trim());
                    setAnswer(''); setMessage('Locked in! Let the guessing begin.');
                    await refresh();
                  } catch { setMessage('Failed to submit.'); }
                  finally { setSubmitting(false); }
                }}>Lock In</Button>
            </Box>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card sx={{ '&.MuiCard-root': { p: 0 }, mb: 2, border: `1px solid ${alpha(theme.palette.divider, 0.3)}` }}>
        <CardContent sx={{ py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{
              width: 32, height: 32, fontSize: '0.8rem', fontWeight: 700,
              bgcolor: theme.palette.secondary.main, color: '#fff',
            }}>
              {currentRound.targetUserName?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Waiting for <strong>{currentRound.targetUserName}</strong> to answer...
              </Typography>
            </Box>
            <LoadingDots size={4} inline />
          </Box>
        </CardContent>
      </Card>
    );
  }

  // ── GUESSING PHASE ──
  if (currentRound?.status === 'active') {
    const isTarget = currentRound.targetUserId === userId;
    const hasGuessed = !!currentRound.myGuess;
    const guessers = currentRound.guessers || [];
    const timeDisplay = getTimeDisplay(currentRound.expiresAt);

    return (
      <Card sx={{        mb: 2, overflow: 'hidden',
        border: `2px solid ${theme.palette.secondary.main}`,
        background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.06)}, transparent)`,
      }}>
        {/* Header bar */}
        <Box sx={{
          px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${theme.palette.secondary.dark}, ${theme.palette.secondary.main})`,
          color: 'white',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupsIcon sx={{ fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
              FAMILY FEUD
            </Typography>
          </Box>
          <Chip size="small" icon={<TimerIcon />} label={timeDisplay}
            sx={{ bgcolor: alpha('#fff', 0.2), color: 'white', fontWeight: 'bold', fontSize: '0.75rem' }} />
        </Box>

        <CardContent>
          {/* Target person spotlight */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5,
            p: 1.25, borderRadius: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.12)}, ${alpha(theme.palette.secondary.light, 0.06)})`,
            border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
          }}>
            <Avatar sx={{
              width: 36, height: 36, fontSize: '0.9rem', fontWeight: 700,
              bgcolor: theme.palette.secondary.main, color: '#fff',
              boxShadow: `0 2px 8px ${alpha(theme.palette.secondary.main, 0.4)}`,
            }}>
              {currentRound.targetUserName?.[0]?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.2 }}>
                {currentRound.targetUserName}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary }}>
                Guess what they answered!
              </Typography>
            </Box>
          </Box>

          {/* Question */}
          <Box sx={{
            p: 1.5, mb: 2, borderRadius: 2, bgcolor: alpha(theme.palette.secondary.main, 0.06),
            borderLeft: `4px solid ${theme.palette.secondary.main}`,
          }}>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {currentRound.question}
            </Typography>
          </Box>

          {/* Who's guessed — live feed */}
          {guessers.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <HowToVoteIcon sx={{ fontSize: 16, color: theme.palette.text.secondary }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {guessers.length} guessed so far
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {guessers.map((g, i) => (
                  <Chip key={i} size="small"
                    avatar={<Avatar sx={{ width: 20, height: 20, fontSize: '0.7rem' }}>
                      {g.userName[0]?.toUpperCase()}
                    </Avatar>}
                    label={`${g.userName} · ${timeAgo(g.submittedAt)}`}
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', animation: `${fadeIn} 0.3s ease-out` }}
                  />
                ))}
              </Box>
            </Box>
          )}

          <Divider sx={{ mb: 2 }} />

          {/* Action area */}
          {isTarget ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <CheckCircleIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />
                <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
                  Locked in! Here&rsquo;s what everyone is seeing:
                </Typography>
              </Box>
              {currentRound.choices ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {currentRound.choices.map((choice, i) => {
                    const isReal = currentRound.realAnswer
                      ? choice.toLowerCase().trim() === currentRound.realAnswer.toLowerCase().trim()
                      : false;
                    return (
                      <Box
                        key={choice}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1,
                          px: 1.5, py: 1.1,
                          borderRadius: 2,
                          border: `2px solid ${isReal ? theme.palette.success.main : alpha(theme.palette.divider, 0.25)}`,
                          bgcolor: isReal ? alpha(theme.palette.success.main, 0.08) : 'transparent',
                        }}
                      >
                        <Box sx={{
                          width: 24, height: 24, borderRadius: '50%', fontSize: '0.75rem',
                          border: `2px solid ${isReal ? theme.palette.success.main : theme.palette.secondary.main}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 'bold',
                          color: isReal ? theme.palette.success.main : theme.palette.secondary.main,
                          flexShrink: 0,
                        }}>
                          {String.fromCharCode(65 + i)}
                        </Box>
                        <Typography sx={{
                          flex: 1,
                          fontSize: '0.9rem',
                          fontWeight: isReal ? 700 : 500,
                          color: isReal ? theme.palette.success.dark : theme.palette.text.primary,
                          textTransform: 'uppercase',
                          letterSpacing: 0.3,
                        }}>
                          {choice}
                        </Typography>
                        {isReal && (
                          <Chip
                            size="small"
                            label="Your answer"
                            sx={{
                              height: 20, fontSize: '0.62rem', fontWeight: 700,
                              bgcolor: theme.palette.success.main,
                              color: '#fff',
                            }}
                          />
                        )}
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Generating choices
                  </Typography>
                  <LoadingDots size={4} inline />
                </Box>
              )}
            </>
          ) : currentRound.choices ? (
            <>
              {message && <Alert severity="info" sx={{ mb: 1 }}>{message}</Alert>}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {currentRound.choices.map((choice, i) => {
                  const isMyPick = hasGuessed && currentRound.myGuess === choice;
                  return (
                    <Button key={choice} variant={isMyPick ? 'contained' : 'outlined'}
                      color="secondary" disabled={hasGuessed || submitting}
                      sx={{
                        justifyContent: 'flex-start', textAlign: 'left', py: 1.2,
                        textTransform: 'uppercase', fontSize: '0.95rem', fontWeight: 700,
                        letterSpacing: 0.5,
                        ...(isMyPick ? {
                          bgcolor: theme.palette.secondary.main,
                          color: '#fff',
                          '&.Mui-disabled': { bgcolor: theme.palette.secondary.main, color: '#fff', opacity: 1 },
                        } : {
                          borderColor: hasGuessed ? alpha(theme.palette.divider, 0.3) : alpha(theme.palette.secondary.main, 0.3),
                          color: hasGuessed ? theme.palette.text.disabled : undefined,
                          '&:hover': !hasGuessed ? { borderColor: theme.palette.secondary.main, bgcolor: alpha(theme.palette.secondary.main, 0.08) } : {},
                        }),
                      }}
                      startIcon={<Box sx={{
                        width: 24, height: 24, borderRadius: '50%', fontSize: '0.8rem',
                        border: `2px solid ${isMyPick ? '#fff' : theme.palette.secondary.main}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                        color: isMyPick ? '#fff' : undefined,
                        ...(hasGuessed && !isMyPick && { borderColor: theme.palette.divider, color: theme.palette.text.disabled }),
                      }}>{String.fromCharCode(65 + i)}</Box>}
                      endIcon={isMyPick ? <CheckCircleIcon sx={{ fontSize: 20 }} /> : undefined}
                      onClick={async () => {
                        setSubmitting(true);
                        try { await submitFamilyFeudGuess(userId, choice); await refresh(); }
                        catch { setMessage('Failed to submit guess.'); }
                        finally { setSubmitting(false); }
                      }}>
                      {choice}
                    </Button>
                  );
                })}
              </Box>
              {hasGuessed && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
                  Your guess is locked in — waiting for results!
                </Typography>
              )}
            </>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">Generating choices</Typography>
              <LoadingDots size={4} inline />
            </Box>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── COMPLETED ROUND — RESULTS ──
  if (currentRound?.status === 'completed' && currentRound.results) {
    const allGuesses = currentRound.allGuesses || [];

    return (
      <Card sx={{        mb: 2, overflow: 'hidden',
        border: `2px solid ${theme.palette.success.main}`,
      }}>
        {/* Header */}
        <Box sx={{
          px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1,
          background: `linear-gradient(135deg, ${theme.palette.success.dark}, ${theme.palette.success.main})`,
          color: 'white',
        }}>
          <EmojiEventsIcon sx={{ fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
            FAMILY FEUD — RESULTS
          </Typography>
        </Box>

        <CardContent>
          {/* Target person + question */}
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1, mb: 1,
          }}>
            <Avatar sx={{
              width: 28, height: 28, fontSize: '0.75rem', fontWeight: 700,
              bgcolor: theme.palette.success.main, color: '#fff',
            }}>
              {currentRound.targetUserName?.[0]?.toUpperCase()}
            </Avatar>
            <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
              {currentRound.targetUserName}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic', color: theme.palette.text.secondary }}>
            &ldquo;{currentRound.question}&rdquo;
          </Typography>
          <Box sx={{
            p: 1.5, mb: 2, borderRadius: 2,
            bgcolor: alpha(theme.palette.success.main, 0.1),
            border: `2px solid ${alpha(theme.palette.success.main, 0.3)}`,
          }}>
            <Typography variant="body1" sx={{ fontWeight: 700, color: theme.palette.success.dark, textTransform: 'uppercase', letterSpacing: 1 }}>
              Answer: "{currentRound.realAnswer}"
            </Typography>
          </Box>

          {/* Everyone's guesses */}
          {allGuesses.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                How everyone guessed:
              </Typography>
              {allGuesses.map((g, i) => (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'center', gap: 1, py: 0.75,
                  animation: `${fadeIn} ${0.2 + i * 0.1}s ease-out`,
                  borderBottom: i < allGuesses.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.15)}` : 'none',
                }}>
                  <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem',
                    bgcolor: g.correct ? theme.palette.success.main : theme.palette.grey[400],
                  }}>
                    {g.userName[0]?.toUpperCase()}
                  </Avatar>
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                    {g.userName}
                  </Typography>
                  <Typography variant="body2" sx={{
                    color: g.correct ? theme.palette.success.main : theme.palette.text.secondary,
                    fontWeight: g.correct ? 700 : 400,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    {g.guess}
                  </Typography>
                  {g.correct
                    ? <CheckCircleIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />
                    : <CancelIcon sx={{ fontSize: 18, color: theme.palette.grey[400] }} />}
                </Box>
              ))}
            </Box>
          )}

          {/* Winners */}
          {currentRound.results.winners.length > 0 ? (
            <Box sx={{
              p: 1.5, borderRadius: 2,
              background: `linear-gradient(135deg, ${alpha('#FFD700', 0.15)}, ${alpha('#FFD700', 0.05)})`,
              border: `1px solid ${alpha('#FFD700', 0.3)}`,
              display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center',
            }}>
              <EmojiEventsIcon sx={{ color: 'goldenrod', fontSize: 20 }} />
              {currentRound.results.winners.map((w) => (
                <Chip key={w.userId} label={`${w.userName} +${w.points}pts`}
                  size="small" sx={{ bgcolor: 'gold', color: '#333', fontWeight: 700 }} />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
              No one got it right this time!
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── RECENT ROUNDS HISTORY ──
  const recentRounds = status.recentRounds || [];
  const completedRounds = recentRounds.filter(r => r.status === 'completed' && r.realAnswer);

  const historySection = completedRounds.length > 0 ? (
    <Box sx={{ mt: 1 }}>
      {completedRounds.slice(0, 3).map((r, i) => (
        <Card key={r.roundId} sx={{
          mb: 1, overflow: 'hidden', borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderLeft: `3px solid ${alpha(theme.palette.secondary.main, 0.4)}`,
        }}>
          <Box sx={{ px: 1.5, py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: theme.palette.text.secondary }}>
                {r.targetUserName}'s round
              </Typography>
              <Typography sx={{ fontSize: '0.6rem', color: theme.palette.text.disabled }}>
                {new Date(r.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.78rem', fontStyle: 'italic', mb: 0.5 }}>
              "{r.question}"
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: theme.palette.success.dark, mb: 0.5, textTransform: 'uppercase' }}>
              Answer: {r.realAnswer}
            </Typography>
            {/* Guesses */}
            {r.allGuesses && r.allGuesses.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {r.allGuesses.map((g, j) => (
                  <Chip key={j} size="small"
                    avatar={<Avatar sx={{ width: 18, height: 18, fontSize: '0.55rem',
                      bgcolor: g.correct ? theme.palette.success.main : theme.palette.grey[400] }}>
                      {g.userName[0]?.toUpperCase()}
                    </Avatar>}
                    label={g.userName}
                    sx={{
                      height: 22, fontSize: '0.6rem',
                      bgcolor: g.correct ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.grey[400], 0.1),
                      border: `1px solid ${g.correct ? alpha(theme.palette.success.main, 0.3) : alpha(theme.palette.divider, 0.15)}`,
                    }}
                    icon={g.correct
                      ? <CheckCircleIcon sx={{ fontSize: '12px !important', color: `${theme.palette.success.main} !important` }} />
                      : <CancelIcon sx={{ fontSize: '12px !important', color: `${theme.palette.grey[400]} !important` }} />}
                  />
                ))}
              </Box>
            )}
            {r.results && r.results.winners.length > 0 && (
              <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
                {r.results!.winners.map((w) => (
                  <Chip key={w.userId} size="small" icon={<EmojiEventsIcon sx={{ fontSize: '12px !important' }} />}
                    label={`${w.userName} +${w.points}`}
                    sx={{ height: 20, fontSize: '0.55rem', fontWeight: 700, bgcolor: alpha('#FFD700', 0.15), color: 'goldenrod' }} />
                ))}
              </Box>
            )}
          </Box>
        </Card>
      ))}
    </Box>
  ) : null;

  // ── NO ACTIVE ROUND (shouldn't reach here since isMyTurn is always true when no round) ──
  if (!currentRound) {
    return historySection;
  }

  return null;
};

export default FamilyFeud;
