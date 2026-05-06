// File: frontend/src/components/Admin/DataTab.tsx
// Per-player data management: facts, trivia, family feud. Card-based, mobile-first.

import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import GroupsIcon from '@mui/icons-material/Groups';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
  Alert,
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
  alpha,
} from '@mui/material';
import React, { useCallback, useState } from 'react';

import AdminCard from './shared/AdminCard';
import ConfirmDialog from './shared/ConfirmDialog';
import EditFactDialog, { FactEdit } from './shared/EditFactDialog';
import EmptyState from './shared/EmptyState';
import {
  deleteUserFact,
  deleteUserTrivia,
  FactEntry,
  getAllStuckSessions,
  getUserFacts,
  getUserTrivia,
  resetGameSession,
  StuckSessionInfo,
  TriviaEntry,
  updateUserFact,
} from '../../api/modules/admin';
import { adminGetFamilyFeud, adminResetFamilyFeud } from '../../api/modules/familyFeud';
import { useAdmin } from '../../contexts/AdminContext';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

const logger = createLogger('DataTab');

const DataTab: React.FC = () => {
  const { adminUserId, players } = useAdmin();
  const theme = useTheme();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [subTab, setSubTab] = useState(0);
  const [facts, setFacts] = useState<FactEntry[]>([]);
  const [trivia, setTrivia] = useState<TriviaEntry[]>([]);
  const [loadingFacts, setLoadingFacts] = useState(false);
  const [loadingTrivia, setLoadingTrivia] = useState(false);
  const [feudData, setFeudData] = useState<any>(null);
  const [loadingFeud, setLoadingFeud] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingFact, setEditingFact] = useState<FactEntry | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteFact, setConfirmDeleteFact] = useState<FactEntry | null>(null);
  const [confirmDeleteTrivia, setConfirmDeleteTrivia] = useState<string | null>(null);
  const [confirmFeudAction, setConfirmFeudAction] = useState<{ action: string; roundId?: string } | null>(null);

  // Stuck sessions (tab 3 — no player selection needed)
  const [stuckSessions, setStuckSessions] = useState<StuckSessionInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState<StuckSessionInfo | null>(null);

  const loadData = useCallback(async (userId: string) => {
    setError(null);
    setLoadingFacts(true);
    setLoadingTrivia(true);
    try {
      const f = await getUserFacts(adminUserId, userId);
      setFacts(f.sort((a, b) => b.date.localeCompare(a.date)));
    } catch { setError('Failed to load facts'); }
    finally { setLoadingFacts(false); }
    try {
      const t = await getUserTrivia(adminUserId, userId);
      setTrivia(t.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    } catch { setError(p => p ? `${p}; Failed to load trivia` : 'Failed to load trivia'); }
    finally { setLoadingTrivia(false); }
  }, [adminUserId]);

  const handleUserChange = (uid: string) => {
    setSelectedUserId(uid);
    setEditingFact(null);
    if (uid) void loadData(uid); else { setFacts([]); setTrivia([]); }
  };

  const handleSaveEditFact = async (changes: FactEdit) => {
    if (!editingFact || !selectedUserId) return;
    setSavingEdit(true);
    try {
      await updateUserFact(adminUserId, {
        userId: selectedUserId,
        timestamp: editingFact.timestamp,
        ...changes,
      });
      setEditingFact(null);
      await loadData(selectedUserId);
    } catch {
      setError('Failed to update fact');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteFact = async () => {
    if (!confirmDeleteFact || !selectedUserId) return;
    try {
      await deleteUserFact(adminUserId, {
        userId: selectedUserId,
        timestamp: confirmDeleteFact.timestamp,
      });
      setConfirmDeleteFact(null);
      await loadData(selectedUserId);
    } catch { setError('Failed to delete fact'); }
  };

  // Detect duplicates: entries sharing the same normalized question text.
  // Displayed as a warning badge so admin can tell what's actually a dupe.
  const factDupeGroups = React.useMemo(() => {
    const groups = new Map<string, number>();
    for (const f of facts) {
      const k = (f.question || '').trim().toLowerCase();
      if (!k) continue;
      groups.set(k, (groups.get(k) || 0) + 1);
    }
    return groups;
  }, [facts]);

  const handleDeleteTrivia = async () => {
    if (!confirmDeleteTrivia || !selectedUserId) return;
    try {
      await deleteUserTrivia(adminUserId, { userId: selectedUserId, timestamps: [confirmDeleteTrivia] });
      setConfirmDeleteTrivia(null); await loadData(selectedUserId);
    } catch { setError('Failed to delete trivia entry'); }
  };

  const loadFeudData = useCallback(async () => {
    setLoadingFeud(true);
    try { setFeudData(await adminGetFamilyFeud(adminUserId)); }
    catch { logger.error('Failed to load feud data'); }
    finally { setLoadingFeud(false); }
  }, [adminUserId]);

  React.useEffect(() => {
    if (subTab === 2 && !feudData && !loadingFeud) loadFeudData();
  }, [subTab, feudData, loadingFeud, loadFeudData]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try { setStuckSessions(await getAllStuckSessions(adminUserId)); }
    catch { setError('Failed to load sessions'); }
    finally { setLoadingSessions(false); }
  }, [adminUserId]);

  React.useEffect(() => {
    if (subTab === 3 && stuckSessions.length === 0 && !loadingSessions) loadSessions();
  }, [subTab, stuckSessions.length, loadingSessions, loadSessions]);

  const handleDeleteSession = async () => {
    if (!confirmDeleteSession) return;
    try {
      const gameType = confirmDeleteSession.type === 'Casino Rush' ? 'casino-rush' : 'slot-machine';
      await resetGameSession(adminUserId, { userId: confirmDeleteSession.userId, gameType: gameType as any });
      setConfirmDeleteSession(null);
      await loadSessions();
    } catch { setError('Failed to delete session'); }
  };

  const handleFeudAction = async () => {
    if (!confirmFeudAction) return;
    try {
      await adminResetFamilyFeud(adminUserId, confirmFeudAction.action as any, confirmFeudAction.roundId);
      setConfirmFeudAction(null); await loadFeudData();
    } catch { setError('Failed to execute action'); }
  };

  const fmtDate = (d: string) => {
    try {
      return new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return d; }
  };

  return (
    <Box>
      {/* User Selector */}
      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Select Player</InputLabel>
        <Select value={selectedUserId} label="Select Player"
          onChange={e => handleUserChange(e.target.value)}>
          <MenuItem value=""><em>None</em></MenuItem>
          {players.map(p => <MenuItem key={p.userId} value={p.userId}>{p.userId}</MenuItem>)}
        </Select>
      </FormControl>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper sx={{
        mb: 2, borderRadius: 3, overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
      }}>
        <Tabs value={subTab} onChange={(_, v) => setSubTab(v)} variant="scrollable" scrollButtons="auto"
          sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', minHeight: 40 } }}>
          <Tab label={`Facts (${facts.length})`} />
          <Tab label={`Trivia (${trivia.length})`} />
          <Tab icon={<GroupsIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Feud" />
          <Tab label="Sessions" />
        </Tabs>
      </Paper>

      {!selectedUserId && subTab < 3 && (
        <EmptyState message="Select a player to view their data" />
      )}

      {(selectedUserId || subTab === 3) && (
        <>

          {/* Facts */}
          {subTab === 0 && (
            loadingFacts ? <LoadingDots mt={2} /> : facts.length === 0 ? (
              <EmptyState message="No facts found for this player" />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {facts.map(fact => {
                  const dupeCount = factDupeGroups.get((fact.question || '').trim().toLowerCase()) || 0;
                  const isDupe = dupeCount > 1;
                  return (
                  <AdminCard
                    key={fact.timestamp || fact.key}
                    badge={
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip label={fmtDate(fact.date)} size="small"
                          sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600 }} />
                        <Chip
                          label={fact.questionType || (fact.key?.startsWith('shared') ? 'shared' : 'basic')}
                          size="small"
                          color={fact.questionType === 'shared' || fact.key?.startsWith('shared') ? 'primary' : 'default'}
                          sx={{ height: 20, fontSize: '0.6rem' }}
                        />
                        {fact.skipped && (
                          <Chip label="skipped" size="small" color="warning" variant="outlined"
                            sx={{ height: 20, fontSize: '0.55rem' }} />
                        )}
                        {isDupe && (
                          <Chip label={`dupe ×${dupeCount}`} size="small" color="error" variant="outlined"
                            sx={{ height: 20, fontSize: '0.55rem' }} />
                        )}
                      </Box>
                    }
                    actions={
                      <>
                        <IconButton size="small" onClick={() => setEditingFact(fact)}>
                          <EditIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => setConfirmDeleteFact(fact)}>
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </>
                    }
                  >
                    <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary, mb: 0.5 }}>
                      {fact.question || '-'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem' }}>
                      {fact.answer || <em style={{ color: '#999' }}>No answer</em>}
                    </Typography>
                  </AdminCard>
                  );
                })}
              </Box>
            )
          )}

          {/* Trivia */}
          {subTab === 1 && (
            loadingTrivia ? <LoadingDots mt={2} /> : trivia.length === 0 ? (
              <EmptyState message="No trivia history for this player" />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {trivia.map(entry => (
                  <AdminCard
                    key={entry.timestamp}
                    badge={
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip label={fmtDate(entry.timestamp)} size="small"
                          sx={{ height: 20, fontSize: '0.6rem' }} />
                        <Chip
                          icon={entry.correct ? <CheckIcon sx={{ fontSize: '12px !important' }} /> : <CloseIcon sx={{ fontSize: '12px !important' }} />}
                          label={entry.correct ? 'Correct' : 'Wrong'}
                          size="small"
                          color={entry.correct ? 'success' : 'error'}
                          sx={{ height: 20, fontSize: '0.6rem' }}
                        />
                        {entry.isCatchingUp && <Chip label="Catchup" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.55rem' }} />}
                        {entry.isCasinoRush && <Chip label="Casino" size="small" variant="outlined" color="warning" sx={{ height: 20, fontSize: '0.55rem' }} />}
                      </Box>
                    }
                    actions={
                      <IconButton size="small" color="error" onClick={() => setConfirmDeleteTrivia(entry.timestamp)}>
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    }
                  >
                    <Typography sx={{ fontSize: '0.78rem', color: theme.palette.text.secondary }}>
                      {entry.question.category || 'Unknown'} · {entry.pointsEarned ?? 0} pts
                    </Typography>
                  </AdminCard>
                ))}
              </Box>
            )
          )}

          {/* Family Feud */}
          {subTab === 2 && (
            loadingFeud ? <LoadingDots mt={2} /> : feudData ? (
              <Box>
                {/* Current Round */}
                <AdminCard highlighted title="Current Round"
                  badge={feudData.currentRound
                    ? <Chip label={feudData.currentRound.status} size="small" color="success" sx={{ height: 20, fontSize: '0.6rem' }} />
                    : <Chip label="No active round" size="small" sx={{ height: 20, fontSize: '0.6rem' }} />
                  }
                >
                  {feudData.currentRound ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Typography sx={{ fontSize: '0.8rem' }}><strong>Target:</strong> {feudData.currentRound.targetUserName}</Typography>
                      <Typography sx={{ fontSize: '0.8rem' }}><strong>Q:</strong> {feudData.currentRound.question}</Typography>
                      <Typography sx={{ fontSize: '0.8rem' }}><strong>Answer:</strong> {feudData.currentRound.realAnswer || '(waiting)'}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                        {Object.keys(feudData.currentRound.guesses || {}).length} guesses
                      </Typography>
                    </Box>
                  ) : (
                    <Typography sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary }}>No active round</Typography>
                  )}
                </AdminCard>

                <Box sx={{ display: 'flex', gap: 1, my: 1.5, flexWrap: 'wrap' }}>
                  <Button size="small" variant="outlined" color="warning" startIcon={<RestartAltIcon />}
                    onClick={() => setConfirmFeudAction({ action: 'reset-current' })}
                    disabled={!feudData.currentRound}>
                    Reset Current
                  </Button>
                  <Button size="small" variant="outlined" color="error" startIcon={<RestartAltIcon />}
                    onClick={() => setConfirmFeudAction({ action: 'reset-rotation' })}>
                    Reset All
                  </Button>
                </Box>

                {/* Recent Rounds */}
                {(feudData.recentRounds || []).length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 0.5 }}>Recent Rounds</Typography>
                    {feudData.recentRounds.map((round: any) => (
                      <AdminCard key={round.roundId}
                        title={round.targetUserName}
                        badge={<Chip label={round.status} size="small" color={round.status === 'completed' ? 'success' : 'warning'} sx={{ height: 20, fontSize: '0.55rem' }} />}
                        actions={
                          <IconButton size="small" color="error"
                            onClick={() => setConfirmFeudAction({ action: 'delete-round', roundId: round.roundId })}>
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        }
                      >
                        <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                          {round.question}
                        </Typography>
                        {round.realAnswer && (
                          <Typography sx={{ fontSize: '0.75rem', mt: 0.25 }}>A: {round.realAnswer}</Typography>
                        )}
                      </AdminCard>
                    ))}
                  </Box>
                )}
              </Box>
            ) : (
              <EmptyState message="Failed to load Family Feud data" />
            )
          )}
        </>
      )}

      {/* Stuck Sessions (tab 3) — shows all users, no player selection needed */}
      {subTab === 3 && (
        loadingSessions ? <LoadingDots mt={2} /> : stuckSessions.length === 0 ? (
          <EmptyState message="No stuck game sessions found" />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {stuckSessions.map((s, i) => (
              <AdminCard
                key={`${s.userId}-${s.type}-${i}`}
                title={s.userId}
                badge={
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={s.type} size="small" sx={{ height: 20, fontSize: '0.6rem' }} />
                    <Chip label={s.status} size="small"
                      color={s.status === 'active' ? 'warning' : s.status === 'completed' ? 'success' : 'error'}
                      sx={{ height: 20, fontSize: '0.6rem' }} />
                  </Box>
                }
                actions={
                  <IconButton size="small" color="error" onClick={() => setConfirmDeleteSession(s)}>
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                }
              >
                <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                  {s.questions > 0
                    ? `${s.answered}/${s.questions} questions answered`
                    : 'No questions generated'}
                  {' · '}Started {fmtDate(s.startTime)}
                </Typography>
              </AdminCard>
            ))}
            <Button size="small" variant="outlined" onClick={() => void loadSessions()} sx={{ mt: 1 }}>
              Refresh
            </Button>
          </Box>
        )
      )}

      <ConfirmDialog open={confirmDeleteSession !== null} title="Delete Session"
        message={confirmDeleteSession ? `Delete ${confirmDeleteSession.type} session for ${confirmDeleteSession.userId}? This will unlock them to play again.` : ''}
        onConfirm={() => void handleDeleteSession()} onCancel={() => setConfirmDeleteSession(null)} />

      <EditFactDialog
        open={editingFact !== null}
        fact={editingFact}
        saving={savingEdit}
        onClose={() => setEditingFact(null)}
        onSave={handleSaveEditFact}
      />

      <ConfirmDialog open={confirmDeleteFact !== null} title="Delete Fact"
        message={
          confirmDeleteFact
            ? `Delete entry "${(confirmDeleteFact.question || '').substring(0, 60)}..." from ${confirmDeleteFact.date}? This removes exactly one entry (by timestamp).`
            : 'Delete this fact?'
        }
        onConfirm={() => void handleDeleteFact()} onCancel={() => setConfirmDeleteFact(null)} />

      <ConfirmDialog open={confirmDeleteTrivia !== null} title="Delete Trivia Entry"
        message="Delete this trivia answer? The user will be able to re-answer."
        onConfirm={() => void handleDeleteTrivia()} onCancel={() => setConfirmDeleteTrivia(null)} />

      <ConfirmDialog open={confirmFeudAction !== null} title="Family Feud Action"
        message={
          confirmFeudAction?.action === 'reset-current' ? 'Reset the current active round? This cannot be undone.' :
          confirmFeudAction?.action === 'delete-round' ? `Delete round ${confirmFeudAction.roundId}?` :
          'Reset the entire rotation? This clears all history and starts fresh.'
        }
        confirmLabel="Confirm"
        onConfirm={() => void handleFeudAction()} onCancel={() => setConfirmFeudAction(null)} />
    </Box>
  );
};

export default DataTab;
