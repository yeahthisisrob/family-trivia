// File: frontend/src/components/Admin/TriviaBankTab.tsx
// Admin trivia bank management — stats dashboard, import, browse, delete.

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState, useEffect, useCallback } from 'react';

import {
  getBankStats,
  browseQuestions,
  deleteQuestion,
  importQuestions,
  BankStats,
  BankQuestion,
  ImportResult,
} from '../../api/modules/triviaBank';
import { useAdmin } from '../../contexts/AdminContext';
import { LoadingDots } from '../ui/feedback';

const SOURCES = [
  { id: 'opentdb', label: 'OpenTDB', desc: 'Open Trivia Database (free, 4000+ Qs)' },
  { id: 'jservice', label: 'jService', desc: 'Jeopardy questions (221K+)' },
  { id: 'ai-rochester', label: 'AI: Rochester, NY', desc: 'AI-generated Rochester trivia' },
  { id: 'ai-brooklyn', label: 'AI: Brooklyn, NY', desc: 'AI-generated Brooklyn trivia' },
  { id: 'ai-custom', label: 'AI: Custom', desc: 'AI-generated for any category' },
];

const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;

const TriviaBankTab: React.FC = () => {
  const theme = useTheme();
  const { adminUserId } = useAdmin();

  const [stats, setStats] = useState<BankStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Import state
  const [importSource, setImportSource] = useState('opentdb');
  const [importCategory, setImportCategory] = useState('');
  const [importDifficulty, setImportDifficulty] = useState<string>('normal');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Browse state
  const [browseCategory, setBrowseCategory] = useState('');
  const [browseDifficulty, setBrowseDifficulty] = useState<string>('normal');
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseOffset, setBrowseOffset] = useState(0);
  const [browsing, setBrowsing] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getBankStats(adminUserId);
      setStats(data);
    } catch (err) {
      setError('Failed to load trivia bank stats');
    } finally {
      setLoading(false);
    }
  }, [adminUserId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleImport = async () => {
    if (!importCategory && !importSource.startsWith('ai-')) return;
    setImporting(true); setImportResult(null); setError(null);
    try {
      const cat = importSource === 'ai-rochester' ? 'Rochester, NY'
        : importSource === 'ai-brooklyn' ? 'Brooklyn, NY'
        : importCategory;
      const result = await importQuestions(adminUserId, importSource, cat, importDifficulty, 50);
      setImportResult(result);
      await loadStats();
    } catch (err) {
      setError('Import failed. Try again.');
    } finally {
      setImporting(false);
    }
  };

  const handleBrowse = async (offset = 0) => {
    if (!browseCategory) return;
    setBrowsing(true);
    try {
      const result = await browseQuestions(adminUserId, browseCategory, browseDifficulty, offset, 20);
      setQuestions(result.questions);
      setBrowseTotal(result.total);
      setBrowseOffset(offset);
      setShowBrowse(true);
    } catch { setError('Failed to browse questions'); }
    finally { setBrowsing(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete || !browseCategory) return;
    try {
      await deleteQuestion(adminUserId, browseCategory, browseDifficulty, confirmDelete);
      setConfirmDelete(null);
      await handleBrowse(browseOffset);
      await loadStats();
    } catch { setError('Failed to delete question'); }
  };

  if (loading) return <LoadingDots mt={0} />;

  return (
    <Box>
      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>}

      {/* Stats Dashboard */}
      {stats && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <LibraryBooksIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {stats.totalQuestions.toLocaleString()} questions
            </Typography>
            <Chip size="small" label={`${stats.questionsAsked} asked`} sx={{ height: 20, fontSize: '0.6rem' }} />
          </Box>

          {/* Category grid */}
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Category</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Easy</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Normal</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Hard</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.categories.map(cat => (
                  <TableRow key={cat.category} hover sx={{ cursor: 'pointer' }}
                    onClick={() => { setBrowseCategory(cat.category); handleBrowse(); }}>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{cat.category}</TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{cat.difficulties.easy}</TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{cat.difficulties.normal}</TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{cat.difficulties.hard}</TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{cat.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Sources */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {stats.sources.map(([source, count]) => (
              <Chip key={source} size="small" label={`${source}: ${count}`}
                sx={{ height: 20, fontSize: '0.6rem' }} variant="outlined" />
            ))}
          </Box>
        </Box>
      )}

      {/* Import Controls */}
      <Card sx={{ overflow: 'hidden', borderRadius: 3, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, mb: 2 }}>
        <Box sx={{
          px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1,
          background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.08)}, ${alpha(theme.palette.info.dark, 0.04)})`,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}>
          <DownloadIcon sx={{ fontSize: 18, color: theme.palette.info.main }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>Import Questions</Typography>
        </Box>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Source</InputLabel>
              <Select value={importSource} label="Source" onChange={(e) => setImportSource(e.target.value)}>
                {SOURCES.map(s => (
                  <MenuItem key={s.id} value={s.id}>
                    <Box>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{s.label}</Typography>
                      <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{s.desc}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {!importSource.startsWith('ai-') || importSource === 'ai-custom' ? (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Category</InputLabel>
                <Select value={importCategory} label="Category"
                  onChange={(e) => setImportCategory(e.target.value)}>
                  {(stats?.categories || []).map(c => (
                    <MenuItem key={c.category} value={c.category}>{c.category}</MenuItem>
                  ))}
                  <MenuItem value="Rochester, NY">Rochester, NY</MenuItem>
                  <MenuItem value="Brooklyn, NY">Brooklyn, NY</MenuItem>
                </Select>
              </FormControl>
            ) : null}

            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Difficulty</InputLabel>
              <Select value={importDifficulty} label="Difficulty"
                onChange={(e) => setImportDifficulty(e.target.value)}>
                {DIFFICULTIES.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </Select>
            </FormControl>

            <Button variant="contained" size="small" disabled={importing}
              startIcon={importing ? <LoadingDots size={4} inline /> : <AddIcon />}
              onClick={handleImport}
              sx={{ bgcolor: theme.palette.info.main, '&:hover': { bgcolor: theme.palette.info.dark } }}>
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </Box>

          {importResult && (
            <Alert severity={importResult.added > 0 ? 'success' : 'warning'} sx={{ fontSize: '0.75rem' }}>
              {importResult.source}: Fetched {importResult.fetched}, Added {importResult.added},
              Duplicates {importResult.duplicates}, Errors {importResult.errors}
            </Alert>
          )}
        </Box>
      </Card>

      {/* Browse Controls */}
      <Card sx={{ overflow: 'hidden', borderRadius: 3, border: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
        <Box sx={{
          px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1,
          background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.08)}, ${alpha(theme.palette.secondary.dark, 0.04)})`,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}>
          <SearchIcon sx={{ fontSize: 18, color: theme.palette.secondary.main }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>Browse Questions</Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Category</InputLabel>
              <Select value={browseCategory} label="Category"
                onChange={(e) => setBrowseCategory(e.target.value)}>
                {(stats?.categories || []).map(c => (
                  <MenuItem key={c.category} value={c.category}>{c.category}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Difficulty</InputLabel>
              <Select value={browseDifficulty} label="Difficulty"
                onChange={(e) => setBrowseDifficulty(e.target.value)}>
                {DIFFICULTIES.map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="outlined" size="small" disabled={!browseCategory || browsing}
              startIcon={browsing ? <LoadingDots size={4} inline /> : <SearchIcon />}
              onClick={() => handleBrowse(0)}>
              Browse
            </Button>
          </Box>

          {showBrowse && (
            <>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 1 }}>
                Showing {browseOffset + 1}-{Math.min(browseOffset + 20, browseTotal)} of {browseTotal}
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Question</TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Answer</TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Source</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {questions.map((q, i) => (
                      <TableRow key={i}>
                        <TableCell sx={{ fontSize: '0.7rem', maxWidth: 250 }}>{q.question}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600 }}>{q.answer}</TableCell>
                        <TableCell sx={{ fontSize: '0.65rem' }}>{q.source}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" color="error"
                            onClick={() => setConfirmDelete(q.question)}>
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1 }}>
                <Button size="small" disabled={browseOffset === 0}
                  onClick={() => handleBrowse(browseOffset - 20)}>Prev</Button>
                <Button size="small" disabled={browseOffset + 20 >= browseTotal}
                  onClick={() => handleBrowse(browseOffset + 20)}>Next</Button>
              </Box>
            </>
          )}
        </Box>
      </Card>

      {/* Delete Confirm */}
      <Dialog open={confirmDelete !== null} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Delete Question</DialogTitle>
        <DialogContent>
          <Typography variant="body2">Delete this question from the bank?</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {confirmDelete?.substring(0, 100)}...
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => void handleDelete()}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TriviaBankTab;
