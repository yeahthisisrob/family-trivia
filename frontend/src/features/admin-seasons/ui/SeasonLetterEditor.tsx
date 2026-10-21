/**
 * Write the letters a family reads when a season starts and when it ends:
 * Markdown on the left, the letter exactly as the family will see it on the
 * right, and an optional photo uploaded to the family's private storage.
 */

import { OPENING_DAYS, openingLetter, type Season, type SeasonNote } from '@family-trivia/shared';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useRef, useState } from 'react';
import { LetterPaper } from '../../../components/SeasonLetter/SeasonLetter';
import { useLetterPaper } from '../../../shared/design-system';
import { currentCircleKind } from '../../../shared/session/session';
import { useMediaUrl, useUpdateSeason, useUploadImage } from '../model/seasons';

type Kind = 'start' | 'end';

interface SeasonLetterEditorProps {
  season: Pick<Season, 'seasonNumber' | 'name' | 'notes'> &
    Partial<Pick<Season, 'trivia' | 'play' | 'pace' | 'perWeek'>> & { message?: string | null };
  onClose: () => void;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const SeasonLetterEditor: React.FC<SeasonLetterEditorProps> = ({ season, onClose }) => {
  const paper = useLetterPaper();
  const [kind, setKind] = useState<Kind>('end');
  const [notes, setNotes] = useState<Record<Kind, SeasonNote>>({
    start: season.notes?.start ?? { markdown: '' },
    end: season.notes?.end ?? { markdown: season.message ?? '' },
  });
  // A photo picked here shows from the file itself, not a link to the upload.
  const [picked, setPicked] = useState<Partial<Record<Kind, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const uploading = useUploadImage();
  const saving = useUpdateSeason();
  const busy = uploading.isPending || saving.isPending;
  const fileInput = useRef<HTMLInputElement>(null);
  const note = notes[kind];
  // Photos uploaded before show through a short-lived link.
  const uploaded = {
    start: useMediaUrl(picked.start ? undefined : notes.start.image).data,
    end: useMediaUrl(picked.end ? undefined : notes.end.image).data,
  };
  const preview = note.image ? (picked[kind] ?? uploaded[kind]) : undefined;

  const update = (patch: Partial<SeasonNote>) =>
    setNotes((n) => ({ ...n, [kind]: { ...n[kind], ...patch } }));

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError('That photo is over 8 MB. A smaller one will load faster for everyone.');
      return;
    }
    setError(null);
    uploading.mutate(
      { file, folder: 'seasons' },
      {
        onSuccess: (key) => {
          update({ image: key });
          setPicked((p) => ({ ...p, [kind]: URL.createObjectURL(file) }));
        },
        onError: () => setError("The photo didn't upload. Check your connection and try again."),
      },
    );
  };

  const save = () => {
    setError(null);
    const clean = (n: SeasonNote): SeasonNote | undefined =>
      n.markdown.trim() || n.image
        ? {
            ...(n.title?.trim() ? { title: n.title.trim() } : {}),
            markdown: n.markdown,
            ...(n.image ? { image: n.image } : {}),
          }
        : undefined;
    const start = clean(notes.start);
    const end = clean(notes.end);
    saving.mutate(
      {
        seasonNumber: season.seasonNumber,
        notes: { ...(start ? { start } : {}), ...(end ? { end } : {}) },
      },
      {
        onSuccess: onClose,
        onError: () => setError("The letters didn't save. Try again."),
      },
    );
  };

  // Nothing written for the start: everyone gets the welcome made from the season's settings.
  const made =
    kind === 'start' && !note.markdown.trim()
      ? openingLetter(season, { kind: currentCircleKind(), first: season.seasonNumber === 1 })
      : null;
  const heading =
    note.title?.trim() || (kind === 'start' ? `${season.name} begins` : `${season.name} has ended`);

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>
        Letters for {season.name}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Everyone sees each letter once: the start letter when the season begins, the end letter
          when it closes. Write it the way you'd write to them. Markdown works: **bold**, *italics*,
          &gt; quotes.
        </Typography>
        <Tabs value={kind} onChange={(_, v: Kind) => setKind(v)} sx={{ mb: 2 }}>
          <Tab value="start" label="When it starts" />
          <Tab value="end" label="When it ends" />
        </Tabs>

        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ alignItems: 'stretch' }}>
          <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
            <TextField
              label="Title (optional)"
              value={note.title ?? ''}
              onChange={(e) => update({ title: e.target.value })}
              placeholder={kind === 'start' ? `${season.name} begins` : `${season.name} has ended`}
              helperText="For example: In memory of…"
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <TextField
              label="Letter"
              multiline
              minRows={12}
              value={note.markdown}
              onChange={(e) => update({ markdown: e.target.value })}
              placeholder={
                kind === 'end'
                  ? 'Thank you, everyone, for playing this season...'
                  : 'Welcome back! This season is all about...'
              }
              slotProps={{ htmlInput: { maxLength: 20000 } }}
            />
            {made && (
              <Alert
                severity="info"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => update({ markdown: made.markdown })}
                  >
                    Start from it
                  </Button>
                }
              >
                Leave it empty and everyone gets the welcome on the right, made from this season's
                settings, with how last season went. It shows for the season's first {OPENING_DAYS}{' '}
                days.
              </Alert>
            )}
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <Button
                variant="outlined"
                startIcon={<AddPhotoAlternateOutlinedIcon />}
                onClick={() => fileInput.current?.click()}
                disabled={busy}
              >
                {note.image ? 'Change photo' : 'Add a photo'}
              </Button>
              {note.image && (
                <Button
                  color="inherit"
                  onClick={() => {
                    update({ image: undefined });
                    setPicked((p) => ({ ...p, [kind]: undefined }));
                  }}
                  disabled={busy}
                >
                  Remove photo
                </Button>
              )}
            </Stack>
          </Stack>

          <Box
            aria-label="Preview"
            sx={{
              flex: 1,
              minWidth: 0,
              bgcolor: paper.paper,
              color: paper.ink,
              borderRadius: 1,
              px: 3,
              py: 4,
              textAlign: 'center',
              maxHeight: 560,
              overflow: 'auto',
            }}
          >
            <LetterPaper
              heading={heading}
              markdown={made?.markdown || note.markdown || '*Your letter appears here.*'}
              imageUrl={preview}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={busy}>
          Save letters
        </Button>
      </DialogActions>
    </Dialog>
  );
};
