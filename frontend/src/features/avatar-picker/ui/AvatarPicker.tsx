/**
 * Choose your picture (docs/decisions/0024). First, one made for you from
 * what you love (say a few words to steer it, or make another); or pick an
 * animal, then its color. Or keep your initials. One tap saves it everywhere.
 */
import {
  ANIMALS,
  type Animal,
  AVATAR_COLORS,
  AVATAR_CREDITS,
  type AvatarChoice,
  type AvatarColor,
} from '@family-trivia/shared';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import {
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { animalSrc, Face, rememberPictureUrl, setAvatarChoice } from '../../../entities/person';
import { avatarApi, type MadePicture } from '../api/avatarApi';

const COLORS = Object.keys(AVATAR_COLORS) as AvatarColor[];
const label = (a: string) => a.replace(/_face$/, '').replace(/_/g, ' ');

interface Props {
  personId: string;
  name: string;
  current?: AvatarChoice | null;
  onClose: () => void;
  /** For stories: skip the server. */
  save?: (a: AvatarChoice | null) => Promise<unknown>;
  make?: (hint?: string) => Promise<MadePicture>;
}

export const AvatarPicker: React.FC<Props> = ({
  personId,
  name,
  current,
  onClose,
  save = avatarApi.save,
  make = avatarApi.make,
}) => {
  const [picked, setPicked] = useState<AvatarChoice | null>(current ?? null);
  const [made, setMade] = useState<MadePicture | null>(null);
  const [making, setMaking] = useState(false);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const started = useRef(false);

  const makeOne = useCallback(
    async (words?: string) => {
      setMaking(true);
      setProblem(null);
      try {
        const m = await make(words);
        rememberPictureUrl(m.key, m.url);
        setMade(m);
        setPicked({ library: 'ai', key: m.key });
      } catch (e) {
        setProblem(e instanceof Error ? e.message : 'The picture didn’t come out. Try again.');
      } finally {
        setMaking(false);
      }
    },
    [make],
  );

  // The first picture is made as the picker opens, unless they already chose one.
  useEffect(() => {
    if (started.current || current) return;
    started.current = true;
    void makeOne();
  }, [current, makeOne]);

  const done = async (choice: AvatarChoice | null) => {
    setBusy(true);
    setProblem(null);
    try {
      await save(choice);
      setAvatarChoice(personId, choice);
      onClose();
    } catch {
      setProblem('That didn’t save. Try again.');
      setBusy(false);
    }
  };

  const animal = picked?.library === 'animal' ? picked : null;
  const pickAnimal = (a: Animal) =>
    setPicked({ library: 'animal', animal: a, color: animal?.color ?? 'sky' });
  const heading = { fontWeight: 700, fontSize: '0.95rem', mb: 1 };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>Your picture</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', justifyContent: 'center', minHeight: 96 }}>
            {making && !made ? (
              <Box sx={{ width: 96, height: 96, display: 'grid', placeItems: 'center' }}>
                <CircularProgress size={32} />
              </Box>
            ) : (
              <Face id={personId} name={name} size={96} avatar={picked} />
            )}
          </Box>

          {animal && (
            <Box
              role="radiogroup"
              aria-label="Color"
              sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}
            >
              {COLORS.map((c) => (
                <ButtonBase
                  key={c}
                  role="radio"
                  aria-checked={c === animal.color}
                  aria-label={c}
                  onClick={() => setPicked({ ...animal, color: c })}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: AVATAR_COLORS[c],
                    outline: c === animal.color ? '3px solid' : '1px solid',
                    outlineColor: c === animal.color ? 'primary.main' : 'divider',
                    outlineOffset: 2,
                  }}
                />
              ))}
            </Box>
          )}

          <Box>
            <Typography sx={heading}>Made for you</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              Drawn from what you love. Say what you'd like instead, if you want.
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                fullWidth
                placeholder="A fox with headphones"
                value={hint}
                onChange={(e) => setHint(e.target.value.slice(0, 160))}
                slotProps={{ htmlInput: { 'aria-label': 'What you’d like' } }}
              />
              <Button
                variant="outlined"
                startIcon={making ? <CircularProgress size={16} /> : <AutoAwesomeRoundedIcon />}
                disabled={making || made?.left === 0}
                onClick={() => void makeOne(hint.trim() || undefined)}
                sx={{ flexShrink: 0 }}
              >
                {made ? 'Another' : 'Make'}
              </Button>
            </Stack>
            {made && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {made.left === 0
                  ? 'That’s today’s pictures. More tomorrow.'
                  : `${made.left} more today`}
              </Typography>
            )}
          </Box>

          <Box>
            <Typography sx={heading}>Or an animal</Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
                gap: 1,
                maxHeight: 220,
                overflowY: 'auto',
                p: 0.5,
              }}
            >
              {ANIMALS.map((a) => {
                const on = animal?.animal === a;
                return (
                  <ButtonBase
                    key={a}
                    aria-label={label(a)}
                    aria-pressed={on}
                    onClick={() => pickAnimal(a)}
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      justifySelf: 'center',
                      bgcolor: AVATAR_COLORS[animal?.color ?? 'sky'],
                      outline: on ? '3px solid' : 'none',
                      outlineColor: 'primary.main',
                      outlineOffset: 2,
                    }}
                  >
                    <Box component="img" src={animalSrc(a)} alt="" sx={{ width: 32, height: 32 }} />
                  </ButtonBase>
                );
              })}
            </Box>
          </Box>

          {problem && (
            <Typography sx={{ color: 'error.main', textAlign: 'center' }}>{problem}</Typography>
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            {AVATAR_CREDITS}
          </Typography>
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
