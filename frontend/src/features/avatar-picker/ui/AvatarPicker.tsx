/**
 * Choose your picture (docs/decisions/0024): a style, then one of nine drawn
 * for you, or keep your initials. One tap saves it everywhere.
 */
import {
  AVATAR_STYLE_LABEL,
  AVATAR_STYLES,
  type AvatarChoice,
  type AvatarStyle,
} from '@family-trivia/shared';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { Face, setAvatarChoice } from '../../../entities/person';
import { avatarApi } from '../api/avatarApi';

interface Props {
  personId: string;
  name: string;
  current?: AvatarChoice | null;
  onClose: () => void;
  /** For stories: skip the server. */
  save?: (a: AvatarChoice | null) => Promise<unknown>;
}

const seedsFor = (personId: string, style: AvatarStyle, round: number) =>
  Array.from({ length: 9 }, (_, i) => `${personId}-${style}-${round * 9 + i}`);

export const AvatarPicker: React.FC<Props> = ({
  personId,
  name,
  current,
  onClose,
  save = avatarApi.save,
}) => {
  const [style, setStyle] = useState<AvatarStyle>(current?.style ?? 'lorelei');
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<AvatarChoice | null>(current ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const done = async (choice: AvatarChoice | null) => {
    setBusy(true);
    setError(false);
    try {
      await save(choice);
      setAvatarChoice(personId, choice);
      onClose();
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>Your picture</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Face id={personId} name={name} size={88} avatar={picked} />
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, justifyContent: 'center' }}>
            {AVATAR_STYLES.map((s) => (
              <Chip
                key={s}
                label={AVATAR_STYLE_LABEL[s]}
                color={s === style ? 'primary' : 'default'}
                variant={s === style ? 'filled' : 'outlined'}
                onClick={() => {
                  setStyle(s);
                  setRound(0);
                }}
              />
            ))}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
            {seedsFor(personId, style, round).map((seed) => {
              const choice: AvatarChoice = { library: 'dicebear', style, seed };
              const on = picked?.style === style && picked.seed === seed;
              return (
                <ButtonBase
                  key={seed}
                  aria-label={`Picture ${seed.split('-').at(-1)}`}
                  aria-pressed={on}
                  onClick={() => setPicked(choice)}
                  sx={{
                    borderRadius: '50%',
                    justifySelf: 'center',
                    outline: on ? '3px solid' : 'none',
                    outlineColor: 'primary.main',
                    outlineOffset: 3,
                  }}
                >
                  <Face id={personId} name={name} size={72} avatar={choice} />
                </ButtonBase>
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button startIcon={<CasinoRoundedIcon />} onClick={() => setRound((r) => r + 1)}>
              Show me more
            </Button>
          </Box>
          {error && (
            <Typography sx={{ color: 'error.main', textAlign: 'center' }}>
              That didn't save. Try again.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        <Button color="inherit" disabled={busy} onClick={() => void done(null)}>
          Use my initials
        </Button>
        <Button variant="contained" disabled={busy || !picked} onClick={() => void done(picked)}>
          Use this one
        </Button>
      </DialogActions>
    </Dialog>
  );
};
