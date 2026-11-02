/**
 * Who's coming, as Herd shows it (docs/decisions/0036): your answer is one
 * tap on Going, Maybe or Can't; everyone's answers are their own chips, their
 * initial in their color and the answer in its tone.
 */
import type { Rsvp, RsvpEntry } from '@family-trivia/shared';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { alpha, Box, Stack, Typography, useTheme } from '@mui/material';
import type React from 'react';
import { Face } from '../../../entities/person';
import { ChipRow, type ChipTone, ChoiceChip } from '../../../shared/design-system';

const ANSWERS: {
  value: Rsvp;
  label: string;
  tone: ChipTone;
  icon: typeof CheckRoundedIcon;
  verb: string;
}[] = [
  { value: 'in', label: 'Going', tone: 'good', icon: CheckRoundedIcon, verb: 'is going' },
  { value: 'maybe', label: 'Maybe', tone: 'watch', icon: HelpOutlineRoundedIcon, verb: 'might go' },
  { value: 'out', label: "Can't", tone: 'bad', icon: CloseRoundedIcon, verb: "can't go" },
];

/** Going, Maybe, Can't: one tap answers, a second tap on the same one takes it back. */
export const AttendancePicker: React.FC<{
  value: Rsvp | null;
  disabled?: boolean;
  onChange: (answer: Rsvp | null) => void;
}> = ({ value, disabled, onChange }) => (
  <ChipRow label="Your answer">
    {ANSWERS.map(({ value: a, label, tone, icon: Icon }) => (
      <ChoiceChip
        key={a}
        tone={tone}
        on={value === a}
        onClick={disabled ? undefined : () => onChange(value === a ? null : a)}
      >
        <Icon /> {label}
      </ChoiceChip>
    ))}
  </ChipRow>
);

/** Everyone's answers: "Bob is going +2", each in the answer's tone, going first. */
export const AttendanceLine: React.FC<{
  rsvps: Record<string, RsvpEntry>;
  me: string;
  nameOf: (id: string) => string;
  /** Show each person's note under their chip. */
  notes?: boolean;
}> = ({ rsvps, me, nameOf, notes }) => {
  const theme = useTheme();
  const tones = {
    good: theme.palette.success.main,
    watch: theme.palette.warning.main,
    bad: theme.palette.error.main,
  };
  const entries = ANSWERS.flatMap((a) =>
    Object.entries(rsvps)
      .filter(([, r]) => r.answer === a.value)
      .map(([id, r]) => ({ id, r, a })),
  );
  if (!entries.length) return null;
  return (
    <Stack spacing={0.75}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {entries.map(({ id, r, a }) => {
          const color = tones[a.tone];
          const Icon = a.icon;
          return (
            <Box
              key={id}
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                borderRadius: 99,
                pl: 0.25,
                pr: 1,
                py: 0.25,
                fontSize: 12,
                fontWeight: 700,
                color,
                bgcolor: alpha(color, 0.14),
              }}
            >
              <Face id={id} name={nameOf(id)} size={20} />
              {id === me ? 'You' : nameOf(id)} {a.verb}
              {r.guests ? ` +${r.guests}` : ''}
              <Icon sx={{ fontSize: 14 }} />
            </Box>
          );
        })}
      </Box>
      {notes &&
        entries
          .filter(({ r }) => r.note)
          .map(({ id, r }) => (
            <Typography key={id} variant="body2" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {id === me ? 'You' : nameOf(id)}:
              </Box>{' '}
              {r.note}
            </Typography>
          ))}
    </Stack>
  );
};
