/**
 * A quick way to answer someone without words: the reactions so far as small
 * pills (tap one to join it, tap yours to take it back) and a button that
 * opens the five to choose from.
 */
import { REACTIONS, type ReactableType, type ReactionId, tally } from '@family-trivia/shared';
import AddReactionOutlinedIcon from '@mui/icons-material/AddReactionOutlined';
import { Box, ButtonBase, IconButton, Popover, Stack, Tooltip, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { useReactions } from '../model/store';

export const ReactionBar: React.FC<{
  contentType: ReactableType;
  contentId: string;
  me: string;
  nameOf?: (userId: string) => string;
}> = ({ contentType, contentId, me, nameOf = (id) => id }) => {
  const { summary, tap } = useReactions(contentType, contentId, me);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const pick = (r: ReactionId) => {
    setAnchor(null);
    void tap(r);
  };

  return (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      {tally(summary).map((r) => {
        const names = summary.by
          .filter((b) => b.reaction === r.id)
          .map((b) => (b.userId === me ? 'You' : nameOf(b.userId)));
        const mine = summary.mine === r.id;
        return (
          <Tooltip key={r.id} title={`${names.join(', ')}: ${r.label}`} arrow>
            <ButtonBase
              onClick={() => pick(r.id)}
              aria-pressed={mine}
              aria-label={`${r.label}, ${r.count}`}
              sx={{
                px: 0.9,
                py: 0.25,
                gap: 0.5,
                borderRadius: 999,
                border: 1,
                borderColor: mine ? 'primary.main' : 'divider',
                bgcolor: mine ? 'action.selected' : 'transparent',
                fontSize: '0.8rem',
              }}
            >
              <span aria-hidden>{r.emoji}</span>
              <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
                {r.count}
              </Typography>
            </ButtonBase>
          </Tooltip>
        );
      })}
      <Tooltip title="React" arrow>
        <IconButton size="small" aria-label="React" onClick={(e) => setAnchor(e.currentTarget)}>
          <AddReactionOutlinedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { borderRadius: 999, px: 0.75, py: 0.5 } } }}
      >
        <Stack direction="row" role="menu" aria-label="Reactions">
          {REACTIONS.map((r) => (
            <Tooltip key={r.id} title={r.label}>
              <ButtonBase
                role="menuitem"
                aria-label={r.label}
                onClick={() => pick(r.id)}
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  fontSize: '1.5rem',
                  transition: 'transform 0.12s',
                  bgcolor: summary.mine === r.id ? 'action.selected' : 'transparent',
                  '&:hover': { transform: 'scale(1.2)' },
                }}
              >
                <Box component="span" aria-hidden>
                  {r.emoji}
                </Box>
              </ButtonBase>
            </Tooltip>
          ))}
        </Stack>
      </Popover>
    </Stack>
  );
};
