/**
 * A memory link's page (docs/decisions/0027), opened by anyone, signed in or
 * not: who the circle remembers, the memories already let in, and a place to
 * add one. Only this person and this circle's name are shown, nothing else.
 */
import type { MemoryLinkPreview } from '@family-trivia/shared';
import { Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { usePaper } from '../../../shared/design-system';
import { memoryLinksApi } from '../api/memoryLinksApi';

const CLOSED: Record<string, string> = {
  expired: 'This link has expired. Ask whoever sent it for a new one.',
  revoked: 'This link was taken back.',
  'used-up': 'This link has closed.',
};

interface ViewProps {
  preview: MemoryLinkPreview | null | 'missing';
  onAdd: (m: { name: string; how?: string; text: string }) => Promise<void>;
}

export const RememberScreenView: React.FC<ViewProps> = ({ preview, onAdd }) => {
  const paper = usePaper();
  const [name, setName] = useState('');
  const [how, setHow] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const field = {
    '& .MuiInputBase-root': { fontFamily: paper.serif, color: paper.ink, bgcolor: paper.glow },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: paper.rule },
    '& .MuiInputLabel-root': { color: paper.inkSoft, fontFamily: paper.serif },
  };
  const serif = { fontFamily: paper.serif };

  const send = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await onAdd({ name: name.trim(), how: how.trim() || undefined, text: text.trim() });
      setSent(true);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'That didn’t send. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const body = () => {
    if (preview === null)
      return (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress sx={{ color: paper.inkSoft }} />
        </Box>
      );
    if (preview === 'missing' || preview.state !== 'open' || !preview.person)
      return (
        <Typography sx={{ ...serif, fontSize: '1.2rem', textAlign: 'center', py: 8 }}>
          {preview === 'missing'
            ? 'This link doesn’t work.'
            : (CLOSED[preview.state] ?? CLOSED.revoked)}
        </Typography>
      );
    const p = preview.person;
    return (
      <Stack spacing={4}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            sx={{
              ...serif,
              color: paper.inkSoft,
              letterSpacing: '0.1em',
              fontSize: '0.8rem',
              textTransform: 'uppercase',
            }}
          >
            Remembering
          </Typography>
          <Typography
            component="h1"
            sx={{ ...serif, fontSize: '2.4rem', fontWeight: 700, lineHeight: 1.15, mt: 0.5 }}
          >
            {p.name}
          </Typography>
          {p.years && (
            <Typography sx={{ ...serif, color: paper.inkSoft, fontSize: '1.1rem' }}>
              {p.years}
            </Typography>
          )}
          {p.dedication && (
            <Typography sx={{ ...serif, fontStyle: 'italic', fontSize: '1.2rem', mt: 1.5 }}>
              {p.dedication}
            </Typography>
          )}
        </Box>

        {sent ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography sx={{ ...serif, fontSize: '1.3rem' }}>Thank you.</Typography>
            <Typography sx={{ ...serif, color: paper.inkSoft, mt: 0.5 }}>
              Your memory of {p.name} will show here once {preview.circle?.name ?? 'the circle'}{' '}
              lets it in.
            </Typography>
            <Button
              onClick={() => {
                setSent(false);
                setText('');
              }}
              sx={{ ...serif, color: paper.ink, mt: 1.5 }}
            >
              Share another
            </Button>
          </Box>
        ) : (
          <Stack spacing={1.5}>
            <Typography component="h2" sx={{ ...serif, fontSize: '1.3rem', fontWeight: 700 }}>
              Share a memory of {p.name}
            </Typography>
            <Typography sx={{ ...serif, color: paper.inkSoft }}>
              No account needed. {preview.circle?.name ?? 'The circle'} will see it first.
            </Typography>
            <TextField
              label="Your name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              sx={field}
            />
            <TextField
              label={`How you knew ${p.name} (if you like)`}
              value={how}
              onChange={(e) => setHow(e.target.value.slice(0, 120))}
              sx={field}
            />
            <TextField
              label="Your memory"
              multiline
              minRows={4}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 2000))}
              sx={field}
            />
            {problem && <Typography sx={{ ...serif, color: paper.ink }}>{problem}</Typography>}
            <Box>
              <Button
                variant="outlined"
                disabled={busy || !name.trim() || !text.trim()}
                onClick={() => void send()}
                sx={{ ...serif, color: paper.ink, borderColor: paper.rule }}
              >
                {busy ? 'Sending…' : 'Share it'}
              </Button>
            </Box>
          </Stack>
        )}

        {!!preview.memories?.length && (
          <Stack spacing={2}>
            <Typography component="h2" sx={{ ...serif, fontSize: '1.3rem', fontWeight: 700 }}>
              What others remember
            </Typography>
            {preview.memories.map((m) => (
              <Box key={m.at + m.name} sx={{ borderLeft: `2px solid ${paper.rule}`, pl: 1.5 }}>
                <Typography sx={{ ...serif, fontSize: '1.05rem', whiteSpace: 'pre-wrap' }}>
                  {m.text}
                </Typography>
                <Typography sx={{ ...serif, color: paper.inkSoft, fontSize: '0.88rem' }}>
                  {m.how ? `${m.name}, ${m.how}` : m.name}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    );
  };

  return (
    <Box
      data-light-surface={paper.light || undefined}
      sx={{ bgcolor: paper.paper, color: paper.ink, minHeight: '100vh' }}
    >
      <Box sx={{ maxWidth: 600, mx: 'auto', px: { xs: 2.5, sm: 3 }, py: 6 }}>{body()}</Box>
    </Box>
  );
};

/** /remember?t=… */
export const RememberScreen: React.FC<{ token: string }> = ({ token }) => {
  const [preview, setPreview] = useState<MemoryLinkPreview | null | 'missing'>(null);
  useEffect(() => {
    memoryLinksApi
      .preview(token)
      .then(setPreview)
      .catch(() => setPreview('missing'));
  }, [token]);
  return (
    <RememberScreenView
      preview={preview}
      onAdd={async (m) => {
        await memoryLinksApi.add(token, m);
      }}
    />
  );
};
