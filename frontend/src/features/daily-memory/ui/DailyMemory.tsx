/**
 * A memory a day, on the Home tab: one past question and everyone's answers,
 * a card like the rest of Home (light or dark), with the book's serif for
 * the question and the answers. Asked on this day in an
 * earlier year when there is one, else a day from our pages; the same for
 * the whole family all day. Anyone can react to an answer, or tap a name to
 * open that person's page.
 */
import type { DailyMemory as Memory } from '@family-trivia/shared';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import { Box, Button, ButtonBase, Paper, Stack, Typography } from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { apiService } from '../../../shared/api/ApiService';
import { identityColor, paper } from '../../../shared/design-system';
import { ReactionBar } from '../../reactions';

/** Answers shown before "Read all". */
const FIRST = 4;

const day = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

export const DailyMemory: React.FC<{
  me: string;
  nameOf: (id: string) => string;
  onOpenPerson?: (id: string) => void;
  /** For stories: skip fetching. */
  memory?: Memory | null;
}> = ({ me, nameOf, onOpenPerson, memory: given }) => {
  const [memory, setMemory] = useState<Memory | null | undefined>(given);
  const [all, setAll] = useState(false);

  useEffect(() => {
    if (given !== undefined) return;
    apiService
      .request<{ memory: Memory | null }>('/family/memory', { method: 'GET' }, 'daily_memory')
      .then((r) => setMemory(r?.memory ?? null))
      .catch(() => setMemory(null));
  }, [given]);

  if (!memory) return null;
  const years = Number(memory.date.slice(0, 4)) - Number(memory.asked.slice(0, 4));
  const kicker =
    memory.kind === 'on-this-day'
      ? `On this day, ${years === 1 ? 'a year ago' : `${years} years ago`}`
      : 'From our pages';
  const shown = all ? memory.answers : memory.answers.slice(0, FIRST);

  return (
    <Paper
      component="section"
      aria-label="A memory from our pages"
      sx={{ p: { xs: 2, sm: 2.5 }, mb: 2, borderRadius: 3 }}
    >
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'primary.main' }}>
        <AutoStoriesOutlinedIcon sx={{ fontSize: 18 }} />
        <Typography
          sx={{
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {kicker}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          · {day(memory.asked)}
        </Typography>
      </Stack>
      <Typography
        component="h2"
        sx={{
          fontFamily: paper.serif,
          fontWeight: 700,
          fontSize: '1.25rem',
          lineHeight: 1.3,
          mt: 1,
        }}
      >
        {memory.question}
      </Typography>
      <Stack spacing={1.25} sx={{ mt: 1.5 }}>
        {shown.map((a) => (
          <Box key={a.id} sx={{ borderLeft: 3, borderColor: identityColor(a.personId), pl: 1.5 }}>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
              <ButtonBase
                disabled={!onOpenPerson}
                onClick={() => onOpenPerson?.(a.personId)}
                sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.secondary' }}
              >
                {nameOf(a.personId)}
              </ButtonBase>
              <Box sx={{ flex: 1 }} />
              <ReactionBar contentType="fact" contentId={a.id} me={me} nameOf={nameOf} />
            </Stack>
            <Typography sx={{ fontFamily: paper.serif, fontSize: '1.05rem', lineHeight: 1.45 }}>
              {a.answer}
            </Typography>
          </Box>
        ))}
      </Stack>
      {!all && memory.answers.length > FIRST && (
        <Button onClick={() => setAll(true)} size="small" sx={{ mt: 1, ml: -0.5 }}>
          Read all {memory.answers.length} answers
        </Button>
      )}
    </Paper>
  );
};
