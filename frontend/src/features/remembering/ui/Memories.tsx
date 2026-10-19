/**
 * The circle's memories of someone, on paper, and a place to add one. Memories
 * from people outside the circle (a memory link, docs/decisions/0027) sit
 * with them, under the name and the few words they gave.
 */
import type { Comment, VisitorMemory } from '@family-trivia/shared';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { usePaper } from '../../../shared/design-system';

const MAX = 1000;

export const Memories: React.FC<{
  name: string;
  memories: Comment[] | null;
  nameOf: (id: string) => string;
  onShare: (text: string) => Promise<void>;
  /** Memories from outside the circle that were let in. */
  visitors?: VisitorMemory[];
}> = ({ name, memories, nameOf, onShare, visitors = [] }) => {
  const paper = usePaper();
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
      {memories?.length === 0 && visitors.length === 0 && (
        <Typography sx={{ fontFamily: paper.serif, color: paper.inkSoft, fontStyle: 'italic' }}>
          No one has shared a memory yet.
        </Typography>
      )}
      {memories &&
        [
          ...memories.map((m) => ({
            id: m.id,
            text: m.text,
            at: m.timestamp,
            by: nameOf(m.userId),
          })),
          ...visitors.map((v) => ({
            id: v.id,
            text: v.text,
            at: v.at,
            by: v.how ? `${v.name}, ${v.how}` : v.name,
          })),
        ]
          .sort((a, b) => a.at.localeCompare(b.at))
          .map((m) => (
            <Box key={m.id} sx={{ borderLeft: `2px solid ${paper.rule}`, pl: 1.5 }}>
              <Typography
                sx={{ fontFamily: paper.serif, fontSize: '1.05rem', whiteSpace: 'pre-wrap' }}
              >
                {m.text}
              </Typography>
              <Typography
                sx={{ fontFamily: paper.serif, color: paper.inkSoft, fontSize: '0.88rem' }}
              >
                {m.by} ·{' '}
                {new Date(m.at).toLocaleDateString(undefined, {
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
