/** The family's memories of someone, on paper, and a place to add one. */
import type { Comment } from '@family-trivia/shared';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { paper } from '../../../shared/design-system';

const MAX = 1000;

export const Memories: React.FC<{
  name: string;
  memories: Comment[] | null;
  nameOf: (id: string) => string;
  onShare: (text: string) => Promise<void>;
}> = ({ name, memories, nameOf, onShare }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const share = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await onShare(text.trim());
      setText('');
    } catch {
      setProblem('That didn’t save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      {memories?.length === 0 && (
        <Typography sx={{ fontFamily: paper.serif, color: paper.inkSoft, fontStyle: 'italic' }}>
          No one has shared a memory yet.
        </Typography>
      )}
      {memories?.map((m) => (
        <Box key={m.id} sx={{ borderLeft: `2px solid ${paper.rule}`, pl: 1.5 }}>
          <Typography sx={{ fontFamily: paper.serif, fontSize: '1.05rem', whiteSpace: 'pre-wrap' }}>
            {m.text}
          </Typography>
          <Typography sx={{ fontFamily: paper.serif, color: paper.inkSoft, fontSize: '0.88rem' }}>
            {nameOf(m.userId)} ·{' '}
            {new Date(m.timestamp).toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Typography>
        </Box>
      ))}
      <TextField
        multiline
        minRows={2}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void share();
        }}
        placeholder={`Share a memory of ${name}…`}
        slotProps={{ htmlInput: { 'aria-label': `Share a memory of ${name}` } }}
        sx={{
          '& .MuiInputBase-root': {
            fontFamily: paper.serif,
            color: paper.ink,
            bgcolor: paper.glow,
          },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: paper.rule },
        }}
      />
      {problem && <Typography sx={{ color: paper.ink }}>{problem}</Typography>}
      <Box>
        <Button
          variant="outlined"
          onClick={share}
          disabled={!text.trim() || busy}
          sx={{ color: paper.ink, borderColor: paper.rule, fontFamily: paper.serif }}
        >
          {busy ? 'Sharing…' : 'Share'}
        </Button>
      </Box>
    </Stack>
  );
};
