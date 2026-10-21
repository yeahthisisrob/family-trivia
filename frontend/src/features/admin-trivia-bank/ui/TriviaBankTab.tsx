/**
 * Admin › Trivia Bank: its numbers by category and difficulty, an import
 * from a source or the AI, and a page at a time to browse and delete from.
 * Server data (docs/decisions/0035).
 */
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
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type React from 'react';
import { useState } from 'react';
import { LoadingDots } from '../../../components/ui/feedback';
import { problemOf } from '../../../shared/admin-ui';
import {
  type BankPage,
  type ImportSource,
  PAGE_SIZE,
  useBankPage,
  useBankStats,
  useDeleteBankQuestion,
  useImportQuestions,
} from '../model/bank';

const SOURCES: { id: ImportSource; label: string; desc: string }[] = [
  { id: 'opentdb', label: 'OpenTDB', desc: 'Open Trivia Database (free, 4000+ Qs)' },
  { id: 'jservice', label: 'jService', desc: 'Jeopardy questions (221K+)' },
  { id: 'ai-hometown', label: 'AI: Springfield', desc: 'AI-generated hometown trivia' },
  { id: 'ai-nearby', label: 'AI: Shelbyville', desc: 'AI-generated Shelbyville trivia' },
  { id: 'ai-custom', label: 'AI: Custom', desc: 'AI-generated for any category' },
];

const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;

export const TriviaBankTab: React.FC = () => {
  const theme = useTheme();
  const read = useBankStats();
  const stats = read.data;
  const importing = useImportQuestions();
  const deleting = useDeleteBankQuestion();
  // The last change that didn't go through, in the server's words.
  const [problem, setProblem] = useState<string | null>(null);

  // Import state
  const [importSource, setImportSource] = useState<ImportSource>('opentdb');
  const [importCategory, setImportCategory] = useState('');
  const [importDifficulty, setImportDifficulty] = useState<string>('normal');
  const importResult = importing.data;

  // Browse state: what's picked, and the page on screen (none until asked for)
  const [browseCategory, setBrowseCategory] = useState('');
  const [browseDifficulty, setBrowseDifficulty] = useState<string>('normal');
  const [page, setPage] = useState<BankPage | null>(null);
  const browse = useBankPage(page);
  const questions = browse.data?.questions ?? [];
  const browseTotal = browse.data?.total ?? 0;
  const browseOffset = page?.offset ?? 0;

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleImport = () => {
    if (!importCategory && !importSource.startsWith('ai-')) return;
    setProblem(null);
    const category =
      importSource === 'ai-hometown'
        ? 'Springfield'
        : importSource === 'ai-nearby'
          ? 'Shelbyville'
          : importCategory;
    importing.mutate(
      { source: importSource, category, difficulty: importDifficulty, count: 50 },
      { onError: (e) => setProblem(problemOf(e)) },
    );
  };

  const showPage = (category: string, offset = 0) =>
    setPage({ category, difficulty: browseDifficulty, offset });
  const turnPage = (by: number) => page && setPage({ ...page, offset: page.offset + by });

  const handleDelete = () => {
    if (!confirmDelete || !page) return;
    // Closed either way: a failure shows above the bank.
    deleting.mutate(
      { category: page.category, difficulty: page.difficulty, question: confirmDelete },
      { onError: (e) => setProblem(problemOf(e)), onSettled: () => setConfirmDelete(null) },
    );
  };

  if (read.isPending) return <LoadingDots mt={0} />;

  return (
    <Box>
      {read.isError && !stats && (
        <Alert severity="error" sx={{ mb: 2, fontSize: '0.8rem' }}>
          The trivia bank's numbers didn't load. Try again in a moment.
        </Alert>
      )}
      {(problem || browse.isError) && (
        <Alert severity="error" onClose={() => setProblem(null)} sx={{ mb: 2, fontSize: '0.8rem' }}>
          {problem ?? "That page didn't load. Try again in a moment."}
        </Alert>
      )}

      {/* Stats Dashboard */}
      {stats && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <LibraryBooksIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {stats.totalQuestions.toLocaleString()} questions
            </Typography>
            <Chip
              size="small"
              label={`${stats.questionsAsked} asked`}
              sx={{ height: 20, fontSize: '0.6rem' }}
            />
          </Box>

          {/* Category grid */}
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Category</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>
                    Easy
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>
                    Normal
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>
                    Hard
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>
                    Total
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.categories.map((cat) => (
                  <TableRow
                    key={cat.category}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      setBrowseCategory(cat.category);
                      showPage(cat.category);
                    }}
                  >
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      {cat.category}
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.75rem' }}>
                      {cat.difficulties.easy}
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.75rem' }}>
                      {cat.difficulties.normal}
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.75rem' }}>
                      {cat.difficulties.hard}
                    </TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
                      {cat.count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Sources */}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {stats.sources.map(([source, count]) => (
              <Chip
                key={source}
                size="small"
                label={`${source}: ${count}`}
                sx={{ height: 20, fontSize: '0.6rem' }}
                variant="outlined"
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Import Controls */}
      <Card
        sx={{
          overflow: 'hidden',
          borderRadius: 3,
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          mb: 2,
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.08)}, ${alpha(theme.palette.info.dark, 0.04)})`,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <DownloadIcon sx={{ fontSize: 18, color: theme.palette.info.main }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>Import Questions</Typography>
        </Box>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Source</InputLabel>
              <Select
                value={importSource}
                label="Source"
                onChange={(e) => setImportSource(e.target.value)}
              >
                {SOURCES.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    <Box>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        {s.label}
                      </Typography>
                      <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                        {s.desc}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {!importSource.startsWith('ai-') || importSource === 'ai-custom' ? (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={importCategory}
                  label="Category"
                  onChange={(e) => setImportCategory(e.target.value)}
                >
                  {(stats?.categories || []).map((c) => (
                    <MenuItem key={c.category} value={c.category}>
                      {c.category}
                    </MenuItem>
                  ))}
                  <MenuItem value="Springfield">Springfield</MenuItem>
                  <MenuItem value="Shelbyville">Shelbyville</MenuItem>
                </Select>
              </FormControl>
            ) : null}

            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Difficulty</InputLabel>
              <Select
                value={importDifficulty}
                label="Difficulty"
                onChange={(e) => setImportDifficulty(e.target.value)}
              >
                {DIFFICULTIES.map((d) => (
                  <MenuItem key={d} value={d}>
                    {d}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              size="small"
              disabled={importing.isPending}
              startIcon={importing.isPending ? <LoadingDots size={4} inline /> : <AddIcon />}
              onClick={handleImport}
              sx={{
                bgcolor: theme.palette.info.main,
                '&:hover': { bgcolor: theme.palette.info.dark },
              }}
            >
              {importing.isPending ? 'Importing...' : 'Import'}
            </Button>
          </Box>

          {importResult && (
            <Alert
              severity={importResult.added > 0 ? 'success' : 'warning'}
              sx={{ fontSize: '0.75rem' }}
            >
              {importResult.source}: Fetched {importResult.fetched}, Added {importResult.added},
              Duplicates {importResult.duplicates}, Errors {importResult.errors}
            </Alert>
          )}
        </Box>
      </Card>

      {/* Browse Controls */}
      <Card
        sx={{
          overflow: 'hidden',
          borderRadius: 3,
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.08)}, ${alpha(theme.palette.secondary.dark, 0.04)})`,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <SearchIcon sx={{ fontSize: 18, color: theme.palette.secondary.main }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>Browse Questions</Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={browseCategory}
                label="Category"
                onChange={(e) => setBrowseCategory(e.target.value)}
              >
                {(stats?.categories || []).map((c) => (
                  <MenuItem key={c.category} value={c.category}>
                    {c.category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Difficulty</InputLabel>
              <Select
                value={browseDifficulty}
                label="Difficulty"
                onChange={(e) => setBrowseDifficulty(e.target.value)}
              >
                {DIFFICULTIES.map((d) => (
                  <MenuItem key={d} value={d}>
                    {d}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              size="small"
              disabled={!browseCategory || browse.isFetching}
              startIcon={browse.isFetching ? <LoadingDots size={4} inline /> : <SearchIcon />}
              onClick={() => showPage(browseCategory)}
            >
              Browse
            </Button>
          </Box>

          {browse.data && (
            <>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 1 }}>
                Showing {browseOffset + 1}-{Math.min(browseOffset + PAGE_SIZE, browseTotal)} of{' '}
                {browseTotal}
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Question</TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Answer</TableCell>
                      <TableCell sx={{ fontSize: '0.7rem', fontWeight: 700 }}>Source</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.7rem', fontWeight: 700 }}>
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {questions.map((q) => (
                      <TableRow key={q.question}>
                        <TableCell sx={{ fontSize: '0.7rem', maxWidth: 250 }}>
                          {q.question}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                          {q.answer}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.65rem' }}>{q.source}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setConfirmDelete(q.question)}
                          >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1 }}>
                <Button
                  size="small"
                  disabled={browseOffset === 0}
                  onClick={() => turnPage(-PAGE_SIZE)}
                >
                  Prev
                </Button>
                <Button
                  size="small"
                  disabled={browseOffset + PAGE_SIZE >= browseTotal}
                  onClick={() => turnPage(PAGE_SIZE)}
                >
                  Next
                </Button>
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
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              mt: 1,
              display: 'block',
            }}
          >
            {confirmDelete?.substring(0, 100)}...
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
