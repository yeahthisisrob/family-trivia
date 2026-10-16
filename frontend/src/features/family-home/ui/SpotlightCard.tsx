/**
 * Today's spotlight: one person, their summary in the app's words, and a
 * button that flips to the roast. People the family remembers never flip.
 */

import type { MemberInsight } from '@family-trivia/shared';
import { Box, Button, Card, Chip, Skeleton, Stack, Typography } from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { getMemberSummary } from '../../../api/modules/user';
import { type PersonView, relationLabel } from '../model/people';
import { Face } from './Face';

export const SpotlightCard: React.FC<{
  person: PersonView;
  next: PersonView | null;
  meId: string | null;
  photo?: string;
  onOpen: (id: string) => void;
}> = ({ person, next, meId, photo, onOpen }) => {
  const [roast, setRoast] = useState(false);
  const [text, setText] = useState<Record<'regular' | 'roast', string | null>>({
    regular: null,
    roast: null,
  });
  const [insights, setInsights] = useState<MemberInsight[]>([]);
  const [failed, setFailed] = useState(false);
  const mode = roast && !person.remembered ? 'roast' : 'regular';

  useEffect(() => {
    if (text[mode] !== null) return;
    getMemberSummary(person.id, mode)
      .then((r) => {
        setText((t) => ({ ...t, [mode]: r.summary }));
        if (mode === 'regular') setInsights(r.insights ?? []);
      })
      .catch(() => setFailed(true));
  }, [person.id, mode, text]);

  const homes = person.homes.map((h) => h.name).join(' & ');

  return (
    <Card sx={{ p: 2.25, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography
          sx={{
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'primary.main',
          }}
        >
          {person.remembered ? 'Remembering' : 'Spotlight'}
        </Typography>
        {!person.remembered && (
          <Button
            size="small"
            variant={roast ? 'contained' : 'outlined'}
            color={roast ? 'secondary' : 'inherit'}
            onClick={() => setRoast((r) => !r)}
            sx={{ borderRadius: 999, minHeight: 32 }}
          >
            {roast ? 'Back to nice' : 'Roast'}
          </Button>
        )}
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Face
          id={person.id}
          name={person.name}
          size={56}
          photo={photo}
          remembered={person.remembered}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '1.2rem', fontWeight: 700 }}>{person.name}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {relationLabel(person.relation, person.id === meId)}
            {homes && ` · ${homes}`}
          </Typography>
        </Box>
      </Stack>

      {text[mode] ? (
        <Typography sx={{ fontSize: '0.98rem', lineHeight: 1.6 }}>{text[mode]}</Typography>
      ) : failed ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          The spotlight isn't ready yet. It's written from what {person.name} has shared.
        </Typography>
      ) : (
        <Box>
          <Skeleton width="100%" />
          <Skeleton width="92%" />
          <Skeleton width="60%" />
        </Box>
      )}

      {mode === 'regular' && insights.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
          {insights.slice(0, 4).map((i) => (
            <Chip key={i.text} label={i.text} size="small" sx={{ bgcolor: 'action.hover' }} />
          ))}
        </Stack>
      )}

      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {next && next.id !== person.id ? `Tomorrow: ${next.name}` : ''}
        </Typography>
        <Button size="small" onClick={() => onOpen(person.id)}>
          See {person.name.split(' ').slice(-1)[0]}
        </Button>
      </Stack>
    </Card>
  );
};
