/**
 * A memory a day, on the Home tab: one past question and everyone's answers,
 * set on paper like a page from the family's book. Asked on this day in an
 * earlier year when there is one, else a day from our pages; the same for
 * the whole family all day. Anyone can react to an answer, or tap a name to
 * open that person's page.
 */
import type { DailyMemory as Memory } from '@family-trivia/shared';
import { Box, Button, ButtonBase, Stack, Typography } from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { apiService } from '../../../services/ApiService';
import { paper } from '../../../shared/design-system';
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
    <Box
      component="section"
      aria-label="A memory from our pages"
      data-light-surface
      sx={{
        bgcolor: paper.paper,
        color: paper.ink,
        borderRadius: 2,
        p: { xs: 2.25, sm: 3 },
        mb: 2,
        boxShadow: `0 6px 18px ${paper.shadow}`,
      }}
    >
      <Typography
        sx={{
          fontFamily: paper.serif,
          fontSize: '0.78rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: paper.inkSoft,
        }}
      >
        {kicker} · {day(memory.asked)}
      </Typography>
      <Typography
        component="h2"
        sx={{
          fontFamily: paper.serif,
          fontWeight: 700,
          fontSize: '1.3rem',
          lineHeight: 1.3,
          mt: 0.75,
        }}
      >
        {memory.question}
      </Typography>
      <Stack spacing={1.25} sx={{ mt: 1.75 }}>
        {shown.map((a) => (
          <Box key={a.id}>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
              <ButtonBase
                disabled={!onOpenPerson}
                onClick={() => onOpenPerson?.(a.personId)}
                sx={{
                  fontFamily: paper.serif,
                  fontSize: '0.8rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: paper.inkSoft,
                }}
              >
                {nameOf(a.personId)}
              </ButtonBase>
              <Box sx={{ flex: 1 }} />
              <Box
                sx={{ '& .MuiButtonBase-root, & .MuiIconButton-root': { color: paper.inkSoft } }}
              >
                <ReactionBar contentType="fact" contentId={a.id} me={me} nameOf={nameOf} />
              </Box>
            </Stack>
            <Typography sx={{ fontFamily: paper.serif, fontSize: '1.08rem', lineHeight: 1.45 }}>
              {a.answer}
            </Typography>
          </Box>
        ))}
      </Stack>
      {!all && memory.answers.length > FIRST && (
        <Button
          onClick={() => setAll(true)}
          sx={{ mt: 1, ml: -1, color: paper.ink, fontFamily: paper.serif }}
        >
          Read all {memory.answers.length} answers
        </Button>
      )}
    </Box>
  );
};
