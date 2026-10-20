/**
 * Your world (docs/decisions/0018): your circles on one night sky, each its
 * own constellation, with you (and anyone else in more than one) as the
 * bridge; what comes up in more than one circle; and who should meet. Built
 * for you alone when you open it; nobody else sees it.
 */
import type { WorldView } from '@family-trivia/shared';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Chip, Dialog, IconButton, Stack, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { colors, identityColor } from '../../../shared/design-system';
import { worldApi } from '../api/worldApi';

type Drawn = { id: string; name: string; color: string; me?: boolean; bridge?: boolean };

interface ViewProps {
  world: WorldView | null;
  onClose: () => void;
}

export const YourWorldView: React.FC<ViewProps> = ({ world, onClose }) => {
  const theme = useTheme();
  const night = theme.palette.night;
  const narrow = useMediaQuery(theme.breakpoints.down('sm'));
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Each circle keeps one color everywhere it's drawn.
  const colorOf = identityColor;
  const nameOf = (id: string) => world?.nodes.find((n) => n.id === id)?.name ?? id;
  const circleName = (id: string) =>
    world?.circles.find((c) => c.id === id.slice(0, id.indexOf(':')))?.name ?? '';

  const data = useMemo(
    () => ({
      nodes: (world?.nodes ?? []).map(
        (n): Drawn => ({
          id: n.id,
          name: n.name,
          color: colorOf(n.circleId),
          me: n.me,
          bridge: n.bridge,
        }),
      ),
      links: (world?.links ?? []).map((l) => ({ source: l.a, target: l.b, kind: l.kind })),
    }),
    [world, colorOf],
  );

  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      slotProps={{ paper: { sx: { bgcolor: night.sky, color: night.text } } }}
    >
      <IconButton
        aria-label="Close"
        onClick={onClose}
        sx={{ position: 'fixed', top: 8, right: 8, color: night.text, zIndex: 1 }}
      >
        <CloseIcon />
      </IconButton>
      <Box sx={{ maxWidth: 960, mx: 'auto', width: '100%', px: 2, py: 5 }}>
        <Typography component="h1" sx={{ fontSize: '1.8rem', fontWeight: 800 }}>
          Your world
        </Typography>
        <Typography sx={{ color: night.textDim, mb: 2 }}>
          All your circles in one sky. Only you see this.
        </Typography>

        {world && !world.enough && (
          <Typography sx={{ color: night.textDim, py: 6, textAlign: 'center' }}>
            When you're in more than one circle, they meet here.
          </Typography>
        )}

        {world?.enough && (
          <>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 1 }}>
              {world.circles.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  size="small"
                  sx={{
                    bgcolor: 'transparent',
                    color: night.text,
                    border: `2px solid ${colorOf(c.id)}`,
                  }}
                />
              ))}
            </Stack>
            <Box
              ref={box}
              sx={{
                width: '100%',
                height: narrow ? 360 : 460,
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <ForceGraph2D
                graphData={data}
                width={width}
                height={narrow ? 360 : 460}
                backgroundColor={night.sky}
                cooldownTicks={120}
                linkColor={(l) =>
                  (l as { kind: string }).kind === 'same' ? colors.medal.gold : night.line
                }
                linkLineDash={(l) => ((l as { kind: string }).kind === 'same' ? [3, 3] : null)}
                linkWidth={(l) => ((l as { kind: string }).kind === 'same' ? 2 : 1)}
                nodeCanvasObject={(node, ctx, scale) => {
                  const n = node as Drawn & { x: number; y: number };
                  const r = n.me ? 7 : n.bridge ? 5.5 : 4;
                  ctx.beginPath();
                  ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
                  ctx.fillStyle = n.color;
                  ctx.fill();
                  if (n.bridge) {
                    ctx.lineWidth = 1.5 / scale;
                    ctx.strokeStyle = colors.onColor;
                    ctx.stroke();
                  }
                  if (scale > 0.8 || n.me) {
                    ctx.font = `${n.me ? 700 : 400} ${11 / scale}px ${theme.typography.fontFamily}`;
                    ctx.fillStyle = night.text;
                    ctx.textAlign = 'center';
                    ctx.fillText(n.me ? 'You' : n.name, n.x, n.y + r + 10 / scale);
                  }
                }}
              />
            </Box>

            {world.threads.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography component="h2" sx={{ fontWeight: 800, fontSize: '1.15rem', mb: 1 }}>
                  What comes up in more than one circle
                </Typography>
                <Stack spacing={1}>
                  {world.threads.map((t) => (
                    <Typography key={`${t.kind}:${t.name}`}>
                      <Box component="span" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                        {t.name}
                      </Box>
                      <Box component="span" sx={{ color: night.textDim }}>
                        {' '}
                        · {t.people.map((p) => `${nameOf(p)} (${circleName(p)})`).join(', ')}
                      </Box>
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}

            {world.meet.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography component="h2" sx={{ fontWeight: 800, fontSize: '1.15rem', mb: 1 }}>
                  Who should meet
                </Typography>
                <Stack spacing={1}>
                  {world.meet.map((m) => (
                    <Typography key={`${m.a}|${m.b}`}>
                      <b>{nameOf(m.a)}</b> ({circleName(m.a)}) and <b>{nameOf(m.b)}</b> (
                      {circleName(m.b)}): both love {m.because}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </>
        )}
      </Box>
    </Dialog>
  );
};

/** Opened from the circle menu. */
export const YourWorld: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [world, setWorld] = useState<WorldView | null>(null);
  useEffect(() => {
    worldApi
      .get()
      .then(setWorld)
      .catch(() =>
        setWorld({ circles: [], enough: false, nodes: [], links: [], threads: [], meet: [] }),
      );
  }, []);
  return <YourWorldView world={world} onClose={onClose} />;
};
