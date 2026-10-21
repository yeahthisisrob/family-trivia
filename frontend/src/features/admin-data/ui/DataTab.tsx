/**
 * Admin › Player Data: one person's facts and trivia, Family Feud, and the
 * plays left open across the circle. Card-based, mobile-first; each part
 * reads its own server data (docs/decisions/0035).
 */
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import GroupsIcon from '@mui/icons-material/Groups';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from '@mui/material';
import type React from 'react';
import { useMemo, useState } from 'react';
import { LoadingDots } from '../../../components/ui/feedback';
import { gameOf } from '../../../games/registry';
import { AdminCard, ConfirmDialog, EmptyState, problemOf } from '../../../shared/admin-ui';
import { colors } from '../../../shared/design-system';
import { useAdminPlayers } from '../../admin-people';
import {
  type AdminFact,
  type AdminTrivia,
  type FactEdit,
  type FeudAction,
  type OpenPlay,
  useAdminFeud,
  useClosePlay,
  useDeleteFact,
  useDeleteTrivia,
  useEditFact,
  useFeudChange,
  useOpenPlays,
  usePlayerFacts,
  usePlayerTrivia,
} from '../model/playerData';
import EditFactDialog from './EditFactDialog';

const FEUD_TAB = 2;
const PLAYS_TAB = 3;

const NO_FACTS: AdminFact[] = [];
const NO_TRIVIA: AdminTrivia[] = [];
const NO_PLAYS: OpenPlay[] = [];

const fmtDate = (d: string) => {
  try {
    return new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return d;
  }
};

export const DataTab: React.FC = () => {
  const players = useAdminPlayers().data?.players ?? [];
  const theme = useTheme();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [subTab, setSubTab] = useState(0);
  const factsRead = usePlayerFacts(selectedUserId);
  const triviaRead = usePlayerTrivia(selectedUserId);
  const feudRead = useAdminFeud(subTab === FEUD_TAB);
  const playsRead = useOpenPlays(subTab === PLAYS_TAB);
  const facts = factsRead.data ?? NO_FACTS;
  const trivia = triviaRead.data ?? NO_TRIVIA;
  const stuckSessions = playsRead.data ?? NO_PLAYS;
  const feudData = feudRead.data;

  const editing = useEditFact();
  const deletingFact = useDeleteFact();
  const deletingTrivia = useDeleteTrivia();
  const closingPlay = useClosePlay();
  const changingFeud = useFeudChange();
  // The last change that didn't go through, in the server's words.
  const [problem, setProblem] = useState<string | null>(null);
  const failed = { onError: (e: Error) => setProblem(problemOf(e)) };

  const [editingFact, setEditingFact] = useState<AdminFact | null>(null);
  const [confirmDeleteFact, setConfirmDeleteFact] = useState<AdminFact | null>(null);
  const [confirmDeleteTrivia, setConfirmDeleteTrivia] = useState<string | null>(null);
  const [confirmFeudAction, setConfirmFeudAction] = useState<{
    action: FeudAction;
    roundId?: string;
  } | null>(null);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<OpenPlay | null>(null);

  const handleUserChange = (uid: string) => {
    setSelectedUserId(uid);
    setEditingFact(null);
  };

  const openEdit = (fact: AdminFact) => {
    editing.reset();
    setEditingFact(fact);
  };

  const handleSaveEditFact = (changes: FactEdit) => {
    if (!editingFact || !selectedUserId) return;
    editing.mutate(
      { userId: selectedUserId, timestamp: editingFact.timestamp, ...changes },
      { onSuccess: () => setEditingFact(null) },
    );
  };

  // Each confirm step closes either way: a failure shows above the list.
  const handleDeleteFact = () => {
    if (!confirmDeleteFact || !selectedUserId) return;
    deletingFact.mutate(
      { userId: selectedUserId, timestamp: confirmDeleteFact.timestamp },
      { ...failed, onSettled: () => setConfirmDeleteFact(null) },
    );
  };

  const handleDeleteTrivia = () => {
    if (!confirmDeleteTrivia || !selectedUserId) return;
    deletingTrivia.mutate(
      { userId: selectedUserId, timestamp: confirmDeleteTrivia },
      { ...failed, onSettled: () => setConfirmDeleteTrivia(null) },
    );
  };

  const handleDeleteSession = () => {
    if (!confirmDeleteSession) return;
    closingPlay.mutate(
      { userId: confirmDeleteSession.userId ?? '', game: confirmDeleteSession.game },
      { ...failed, onSettled: () => setConfirmDeleteSession(null) },
    );
  };

  const handleFeudAction = () => {
    if (!confirmFeudAction) return;
    changingFeud.mutate(confirmFeudAction, {
      ...failed,
      onSettled: () => setConfirmFeudAction(null),
    });
  };

  // Detect duplicates: entries sharing the same normalized question text.
  // Displayed as a warning badge so admin can tell what's actually a dupe.
  const factDupeGroups = useMemo(() => {
    const groups = new Map<string, number>();
    for (const f of facts) {
      const k = (f.question || '').trim().toLowerCase();
      if (!k) continue;
      groups.set(k, (groups.get(k) || 0) + 1);
    }
    return groups;
  }, [facts]);

  return (
    <Box>
      {/* User Selector */}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Select Player</InputLabel>
        <Select
          value={selectedUserId}
          label="Select Player"
          onChange={(e) => handleUserChange(e.target.value)}
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {players.map((p) => (
            <MenuItem key={p.userId} value={p.userId}>
              {p.userId}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {problem && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setProblem(null)}>
          {problem}
        </Alert>
      )}

      <Paper
        sx={{
          mb: 2,
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        }}
      >
        <Tabs
          value={subTab}
          onChange={(_, v) => setSubTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              minHeight: 40,
            },
          }}
        >
          <Tab label={`Facts (${facts.length})`} />
          <Tab label={`Trivia (${trivia.length})`} />
          <Tab icon={<GroupsIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Feud" />
          <Tab label="Sessions" />
        </Tabs>
      </Paper>

      {!selectedUserId && subTab < FEUD_TAB && (
        <EmptyState message="Select a player to view their data" />
      )}

      {/* Facts */}
      {selectedUserId &&
        subTab === 0 &&
        (factsRead.isPending ? (
          <LoadingDots mt={2} />
        ) : factsRead.isError && !factsRead.data ? (
          <Alert severity="error">Facts didn't load. Try again in a moment.</Alert>
        ) : facts.length === 0 ? (
          <EmptyState message="No facts found for this player" />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {facts.map((fact) => {
              const dupeCount = factDupeGroups.get((fact.question || '').trim().toLowerCase()) || 0;
              const isDupe = dupeCount > 1;
              return (
                <AdminCard
                  key={fact.timestamp || fact.key}
                  badge={
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip
                        label={fmtDate(fact.date)}
                        size="small"
                        sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600 }}
                      />
                      <Chip
                        label={
                          fact.questionType || (fact.key?.startsWith('shared') ? 'shared' : 'basic')
                        }
                        size="small"
                        color={
                          fact.questionType === 'shared' || fact.key?.startsWith('shared')
                            ? 'primary'
                            : 'default'
                        }
                        sx={{ height: 20, fontSize: '0.6rem' }}
                      />
                      {fact.skipped && (
                        <Chip
                          label="skipped"
                          size="small"
                          color="warning"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.55rem' }}
                        />
                      )}
                      {isDupe && (
                        <Chip
                          label={`dupe ×${dupeCount}`}
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.55rem' }}
                        />
                      )}
                    </Box>
                  }
                  actions={
                    <>
                      <IconButton size="small" onClick={() => openEdit(fact)}>
                        <EditIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setConfirmDeleteFact(fact)}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </>
                  }
                >
                  <Typography
                    sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, mb: 0.5 }}
                  >
                    {fact.question || '-'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.82rem' }}>
                    {fact.answer || <em style={{ color: colors.text.disabled }}>No answer</em>}
                  </Typography>
                </AdminCard>
              );
            })}
          </Box>
        ))}

      {/* Trivia */}
      {selectedUserId &&
        subTab === 1 &&
        (triviaRead.isPending ? (
          <LoadingDots mt={2} />
        ) : triviaRead.isError && !triviaRead.data ? (
          <Alert severity="error">Trivia didn't load. Try again in a moment.</Alert>
        ) : trivia.length === 0 ? (
          <EmptyState message="No trivia history for this player" />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {trivia.map((entry) => {
              const game = gameOf(entry);
              return (
                <AdminCard
                  key={entry.timestamp}
                  badge={
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip
                        label={fmtDate(entry.timestamp)}
                        size="small"
                        sx={{ height: 20, fontSize: '0.6rem' }}
                      />
                      <Chip
                        icon={
                          entry.correct ? (
                            <CheckIcon sx={{ fontSize: '12px !important' }} />
                          ) : (
                            <CloseIcon sx={{ fontSize: '12px !important' }} />
                          )
                        }
                        label={entry.correct ? 'Correct' : 'Wrong'}
                        size="small"
                        color={entry.correct ? 'success' : 'error'}
                        sx={{ height: 20, fontSize: '0.6rem' }}
                      />
                      {entry.isCatchingUp && (
                        <Chip
                          label="Catchup"
                          size="small"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.55rem' }}
                        />
                      )}
                      {game && (
                        <Chip
                          label={game.label}
                          size="small"
                          variant="outlined"
                          color="warning"
                          sx={{ height: 20, fontSize: '0.55rem' }}
                        />
                      )}
                    </Box>
                  }
                  actions={
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setConfirmDeleteTrivia(entry.timestamp)}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  }
                >
                  <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary }}>
                    {entry.question.category || 'Unknown'} · {entry.pointsEarned ?? 0} pts
                  </Typography>
                </AdminCard>
              );
            })}
          </Box>
        ))}

      {/* Family Feud (the whole circle's, no player needed) */}
      {subTab === FEUD_TAB &&
        (feudRead.isPending ? (
          <LoadingDots mt={2} />
        ) : feudData ? (
          <Box>
            {/* Current Round */}
            <AdminCard
              highlighted
              title="Current Round"
              badge={
                feudData.currentRound ? (
                  <Chip
                    label={feudData.currentRound.status}
                    size="small"
                    color="success"
                    sx={{ height: 20, fontSize: '0.6rem' }}
                  />
                ) : (
                  <Chip
                    label="No active round"
                    size="small"
                    sx={{ height: 20, fontSize: '0.6rem' }}
                  />
                )
              }
            >
              {feudData.currentRound ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.8rem' }}>
                    <strong>Target:</strong> {feudData.currentRound.targetUserName}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem' }}>
                    <strong>Q:</strong> {feudData.currentRound.question}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem' }}>
                    <strong>Answer:</strong> {feudData.currentRound.realAnswer || '(waiting)'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                    {Object.keys(feudData.currentRound.guesses).length} guesses
                  </Typography>
                </Box>
              ) : (
                <Typography sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary }}>
                  No active round
                </Typography>
              )}
            </AdminCard>

            <Box sx={{ display: 'flex', gap: 1, my: 1.5, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                startIcon={<RestartAltIcon />}
                onClick={() => setConfirmFeudAction({ action: 'reset-current' })}
                disabled={!feudData.currentRound}
              >
                Reset Current
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<RestartAltIcon />}
                onClick={() => setConfirmFeudAction({ action: 'reset-rotation' })}
              >
                Reset All
              </Button>
            </Box>

            {/* Recent Rounds */}
            {feudData.recentRounds.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.5 }}>
                  Recent Rounds
                </Typography>
                {feudData.recentRounds.map((round) => (
                  <AdminCard
                    key={round.roundId}
                    title={round.targetUserName}
                    badge={
                      <Chip
                        label={round.status}
                        size="small"
                        color={round.status === 'completed' ? 'success' : 'warning'}
                        sx={{ height: 20, fontSize: '0.55rem' }}
                      />
                    }
                    actions={
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          setConfirmFeudAction({ action: 'delete-round', roundId: round.roundId })
                        }
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    }
                  >
                    <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                      {round.question}
                    </Typography>
                    {round.realAnswer && (
                      <Typography sx={{ fontSize: '0.75rem', mt: 0.25 }}>
                        A: {round.realAnswer}
                      </Typography>
                    )}
                  </AdminCard>
                ))}
              </Box>
            )}
          </Box>
        ) : (
          <EmptyState message="Failed to load Family Feud data" />
        ))}

      {/* Stuck Sessions: every player's, no player selection needed */}
      {subTab === PLAYS_TAB &&
        (playsRead.isPending ? (
          <LoadingDots mt={2} />
        ) : playsRead.isError && !playsRead.data ? (
          <Alert severity="error">Sessions didn't load. Try again in a moment.</Alert>
        ) : stuckSessions.length === 0 ? (
          <EmptyState message="No stuck game sessions found" />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {stuckSessions.map((s) => (
              <AdminCard
                key={`${s.userId}-${s.game}`}
                title={s.userId}
                badge={
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={s.type} size="small" sx={{ height: 20, fontSize: '0.6rem' }} />
                    <Chip
                      label={s.status}
                      size="small"
                      color={
                        s.status === 'active'
                          ? 'warning'
                          : s.status === 'completed'
                            ? 'success'
                            : 'error'
                      }
                      sx={{ height: 20, fontSize: '0.6rem' }}
                    />
                  </Box>
                }
                actions={
                  <IconButton size="small" color="error" onClick={() => setConfirmDeleteSession(s)}>
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                }
              >
                <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                  {s.questions
                    ? `${s.answered ?? 0}/${s.questions} questions answered`
                    : 'No questions generated'}
                  {' · '}Started {fmtDate(s.startTime ?? '')}
                </Typography>
              </AdminCard>
            ))}
            <Button
              size="small"
              variant="outlined"
              disabled={playsRead.isFetching}
              onClick={() => void playsRead.refetch()}
              sx={{ mt: 1 }}
            >
              Refresh
            </Button>
          </Box>
        ))}

      <ConfirmDialog
        open={confirmDeleteSession !== null}
        title="Delete Session"
        message={
          confirmDeleteSession
            ? `Delete ${confirmDeleteSession.type} session for ${confirmDeleteSession.userId}? This will unlock them to play again.`
            : ''
        }
        onConfirm={handleDeleteSession}
        onCancel={() => setConfirmDeleteSession(null)}
      />

      <EditFactDialog
        open={editingFact !== null}
        fact={editingFact}
        saving={editing.isPending}
        error={problemOf(editing.error)}
        onClose={() => setEditingFact(null)}
        onSave={handleSaveEditFact}
      />

      <ConfirmDialog
        open={confirmDeleteFact !== null}
        title="Delete Fact"
        message={
          confirmDeleteFact
            ? `Delete entry "${(confirmDeleteFact.question || '').substring(0, 60)}..." from ${confirmDeleteFact.date}? This removes exactly one entry (by timestamp).`
            : 'Delete this fact?'
        }
        onConfirm={handleDeleteFact}
        onCancel={() => setConfirmDeleteFact(null)}
      />

      <ConfirmDialog
        open={confirmDeleteTrivia !== null}
        title="Delete Trivia Entry"
        message="Delete this trivia answer? The user will be able to re-answer."
        onConfirm={handleDeleteTrivia}
        onCancel={() => setConfirmDeleteTrivia(null)}
      />

      <ConfirmDialog
        open={confirmFeudAction !== null}
        title="Family Feud Action"
        message={
          confirmFeudAction?.action === 'reset-current'
            ? 'Reset the current active round? This cannot be undone.'
            : confirmFeudAction?.action === 'delete-round'
              ? `Delete round ${confirmFeudAction.roundId}?`
              : 'Reset the entire rotation? This clears all history and starts fresh.'
        }
        confirmLabel="Confirm"
        onConfirm={handleFeudAction}
        onCancel={() => setConfirmFeudAction(null)}
      />
    </Box>
  );
};
