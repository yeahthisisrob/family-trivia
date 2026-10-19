/**
 * The family as a night sky: everyone as a star, connected by family ties
 * and by the answers they share. Click someone to light up their threads and
 * read how you're related and what you both said. Drawn on the night surface,
 * which is dark in every theme (docs/decisions/0011).
 */

import { relationOf, yourRelation } from '@family-trivia/shared';
import CloseIcon from '@mui/icons-material/Close';
import {
  Autocomplete,
  alpha,
  Box,
  Button,
  Chip,
  IconButton,
  Slider,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { useCircleWords } from '../../../entities/circle';
import type { GraphData } from '../../../entities/family';
import { colors, identityColor } from '../../../shared/design-system';
import {
  asFamily,
  buildGraph,
  DEFAULT_OPTIONS,
  type GraphLink,
  type GraphNode,
  type GraphOptions,
  type LinkKind,
  likenessesOf,
} from '../model/buildGraph';
import { RING } from '../model/buildMap';
import { drawNebula, drawStars, starfield } from '../model/sky';

const STARS = starfield(500, RING.rx * 3, RING.ry * 3);

type Placed = GraphNode & { x?: number; y?: number };
type Drawn = Omit<GraphLink, 'source' | 'target'> & {
  source: string | Placed;
  target: string | Placed;
};

const idOf = (end: string | Placed) => (typeof end === 'string' ? end : end.id);

const LINK_STYLE: Record<LinkKind, { label: string; dash?: number[] }> = {
  partner: { label: 'Partners' },
  'former-partner': { label: 'Former partners', dash: [2, 3] },
  parent: { label: 'Parent and child' },
  kin: { label: 'Family', dash: [1, 2] },
  friend: { label: 'Friends', dash: [4, 2] },
  household: { label: 'Household', dash: [1, 3] },
  alike: { label: 'Answered alike' },
};

interface FamilyGraphProps {
  data: GraphData;
  /** The person looking: relations are shown relative to them. */
  meId?: string | null;
  height?: number;
  onOpenProfile?: (personId: string) => void;
  initialOptions?: Partial<GraphOptions>;
}

export const FamilyGraph: React.FC<FamilyGraphProps> = ({
  data,
  meId,
  height = 560,
  onOpenProfile,
  initialOptions,
}) => {
  const theme = useTheme();
  const { kind, words } = useCircleWords();
  const night = theme.palette.night;
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const fg = useRef<ForceGraphMethods | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [opts, setOpts] = useState<GraphOptions>({ ...DEFAULT_OPTIONS, ...initialOptions });
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const family = useMemo(() => asFamily(data), [data]);
  const graph = useMemo(() => buildGraph(data, opts), [data, opts]);
  const maxCount = useMemo(() => Math.max(1, ...data.likenesses.map((l) => l.count)), [data]);
  const maxWeight = useMemo(() => Math.max(1, ...graph.nodes.map((n) => n.weight)), [graph]);

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of graph.links) {
      const a = l.source;
      const b = l.target;
      if (!m.has(a)) m.set(a, new Set());
      if (!m.has(b)) m.set(b, new Set());
      m.get(a)?.add(b);
      m.get(b)?.add(a);
    }
    return m;
  }, [graph]);

  const active = focus ?? hover;
  const lit = (id: string) => !active || id === active || !!neighbors.get(active)?.has(id);

  // Spread people out so names have room, and fit once the layout settles.
  useEffect(() => {
    fg.current?.d3Force('charge')?.strength?.(-140);
    fg.current
      ?.d3Force('link')
      ?.distance?.((l: Drawn) => (l.kind === 'alike' ? 70 : l.kind === 'household' ? 40 : 48));
  }, [graph]);

  const toneOf = (n: Placed) =>
    n.kind === 'household'
      ? night.textDim
      : n.person?.remembered
        ? night.remembered
        : identityColor(n.id);

  const linkColor = (l: Drawn) => {
    const on = !active || idOf(l.source) === active || idOf(l.target) === active;
    const base =
      l.kind === 'alike'
        ? theme.palette.secondary.light
        : l.kind === 'partner'
          ? colors.accent.pink
          : l.kind === 'parent'
            ? night.text
            : night.line;
    const strength =
      l.kind === 'alike' ? 0.25 + Math.min(1, (l.count ?? 1) / maxCount) * 0.55 : 0.55;
    return alpha(base, on ? strength : 0.05);
  };

  const focused = focus ? graph.nodes.find((n) => n.id === focus) : undefined;
  const alikeList = focus ? likenessesOf(data, focus).slice(0, 6) : [];
  const nameOf = (id: string) => data.people.find((p) => p.id === id)?.name ?? id;

  const toggle = (k: 'ties' | 'households' | 'alike') => setOpts((o) => ({ ...o, [k]: !o[k] }));
  const chipSx = (on: boolean) => ({
    bgcolor: on ? alpha(night.text, 0.16) : 'transparent',
    color: on ? night.text : night.textDim,
    border: `1px solid ${alpha(night.text, on ? 0.3 : 0.15)}`,
  });

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'grid',
        // minmax(0, …): the canvas has a fixed width, so a plain 1fr column
        // never shrinks and the panel beside it gets clipped.
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: focused ? 'minmax(0, 1fr) 300px' : '1fr' },
        bgcolor: night.sky,
        color: night.text,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box ref={box} sx={{ position: 'relative', minHeight: height, minWidth: 0 }}>
        <Stack
          direction="row"
          sx={{
            position: 'absolute',
            zIndex: 2,
            top: 12,
            left: 12,
            right: 12,
            gap: 1,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Chip
            size="small"
            label={words.ties}
            onClick={() => toggle('ties')}
            sx={chipSx(opts.ties)}
          />
          <Chip
            size="small"
            label="Answered alike"
            onClick={() => toggle('alike')}
            sx={chipSx(opts.alike)}
          />
          <Chip
            size="small"
            label={words.groups}
            onClick={() => toggle('households')}
            sx={chipSx(opts.households)}
          />
          {opts.alike && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 170 }}>
              <Typography sx={{ fontSize: 11.5, color: night.textDim, whiteSpace: 'nowrap' }}>
                at least {opts.minAlike}
              </Typography>
              <Slider
                size="small"
                min={1}
                max={Math.max(2, Math.min(15, maxCount))}
                value={opts.minAlike}
                onChange={(_, v) => setOpts((o) => ({ ...o, minAlike: v as number }))}
                aria-label="Fewest shared answers to draw a thread"
                sx={{ color: theme.palette.secondary.light, width: 90 }}
              />
            </Stack>
          )}
          <Box sx={{ flex: 1 }} />
          <Autocomplete
            size="small"
            options={data.people}
            getOptionLabel={(p) => p.name}
            onChange={(_, p) => p && setFocus(p.id)}
            sx={{ width: narrow ? '100%' : 200 }}
            renderInput={(p) => (
              <TextField
                {...p}
                placeholder="Find someone"
                sx={{
                  '& .MuiInputBase-root': { color: night.text, bgcolor: alpha(night.text, 0.06) },
                }}
              />
            )}
          />
        </Stack>

        <ForceGraph2D
          ref={fg}
          width={width}
          height={height}
          graphData={graph as { nodes: object[]; links: object[] }}
          backgroundColor={night.sky}
          cooldownTicks={160}
          onEngineStop={() => fg.current?.zoomToFit(400, 56)}
          onRenderFramePre={(ctx, scale) => {
            drawStars(ctx, STARS, night.text, scale);
            // Each person's own light, added where people gather.
            drawNebula(
              ctx,
              (graph.nodes as Placed[])
                .filter((n) => n.kind === 'person' && Number.isFinite(n.x))
                .map((n) => ({
                  x: n.x as number,
                  y: n.y as number,
                  r: 70,
                  color: n.person?.remembered ? night.remembered : identityColor(n.id),
                  a: active && !lit(n.id) ? 0.015 : 0.07,
                })),
            );
          }}
          d3VelocityDecay={0.3}
          onNodeClick={(n) => {
            const node = n as Placed;
            if (node.kind === 'person') setFocus(node.id === focus ? null : node.id);
          }}
          onBackgroundClick={() => setFocus(null)}
          onNodeHover={(n) => setHover(n ? (n as Placed).id : null)}
          linkColor={(l) => linkColor(l as Drawn)}
          linkWidth={(l) => {
            const e = l as Drawn;
            const on = idOf(e.source) === active || idOf(e.target) === active;
            return e.kind === 'alike'
              ? 0.6 + ((e.count ?? 1) / maxCount) * 3 + (on ? 1 : 0)
              : on
                ? 2.4
                : 1.4;
          }}
          linkLineDash={(l) => LINK_STYLE[(l as Drawn).kind].dash ?? null}
          linkCurvature={(l) => ((l as Drawn).kind === 'alike' ? 0.22 : 0)}
          linkDirectionalParticles={(l) => {
            const e = l as Drawn;
            return active &&
              (idOf(e.source) === active || idOf(e.target) === active) &&
              e.kind !== 'household'
              ? 2
              : 0;
          }}
          linkDirectionalParticleWidth={2.2}
          linkDirectionalParticleColor={(l) => linkColor(l as Drawn)}
          nodeCanvasObject={(n, ctx, scale) => {
            const node = n as Placed;
            if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
            const x = node.x as number;
            const y = node.y as number;
            const tone = toneOf(node);
            const on = lit(node.id);
            const isFocus = node.id === focus;
            const paused =
              node.person && node.person.participation !== 'playing' && !node.person.remembered;

            if (node.kind === 'household') {
              const r = 5;
              ctx.beginPath();
              for (let k = 0; k < 6; k++) {
                const a = (Math.PI / 3) * k;
                ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
              }
              ctx.closePath();
              ctx.strokeStyle = alpha(night.text, on ? 0.6 : 0.15);
              ctx.lineWidth = 1.2 / scale;
              ctx.stroke();
            } else {
              const r = 2.5 + Math.sqrt(node.weight / maxWeight) * 3.5 + (isFocus ? 1.5 : 0);
              const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.6);
              glow.addColorStop(0, alpha(tone, on ? (isFocus ? 0.6 : 0.35) : 0.08));
              glow.addColorStop(1, alpha(tone, 0));
              ctx.fillStyle = glow;
              ctx.beginPath();
              ctx.arc(x, y, r * 3.6, 0, 2 * Math.PI);
              ctx.fill();
              ctx.globalAlpha = on ? (paused ? 0.55 : 1) : 0.2;
              ctx.fillStyle = tone;
              ctx.beginPath();
              ctx.arc(x, y, r, 0, 2 * Math.PI);
              ctx.fill();
              if (node.person?.remembered) {
                // A halo for someone the family remembers.
                ctx.strokeStyle = alpha(night.halo, 0.85);
                ctx.lineWidth = 1 / scale;
                ctx.beginPath();
                ctx.arc(x, y, r + 2.5, 0, 2 * Math.PI);
                ctx.stroke();
              }
              if (node.id === meId) {
                ctx.strokeStyle = night.text;
                ctx.lineWidth = 1.4 / scale;
                ctx.beginPath();
                ctx.arc(x, y, r + 1.6, 0, 2 * Math.PI);
                ctx.stroke();
              }
              ctx.globalAlpha = 1;
            }

            if (
              on &&
              (scale > 0.9 || isFocus || node.id === hover || node.kind === 'household' || !active)
            ) {
              ctx.font = `${isFocus ? 600 : 400} ${(isFocus ? 13 : 11) / scale}px ${theme.typography.fontFamily}`;
              ctx.fillStyle = alpha(night.text, isFocus || node.id === hover ? 0.95 : 0.7);
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              const below =
                node.kind === 'household' ? 7 : 2.5 + Math.sqrt(node.weight / maxWeight) * 3.5 + 4;
              ctx.fillText(node.label, x, y + below);
            }
          }}
          nodePointerAreaPaint={(n, color, ctx) => {
            const node = n as Placed;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x as number, node.y as number, 10, 0, 2 * Math.PI);
            ctx.fill();
          }}
        />

        <Stack
          direction="row"
          sx={{
            position: 'absolute',
            bottom: 10,
            left: 12,
            gap: 1.5,
            flexWrap: 'wrap',
            pointerEvents: 'none',
          }}
        >
          {[
            { label: 'Remembered', tone: night.remembered },
            { label: 'Partners', tone: colors.accent.pink },
            { label: 'Answered alike', tone: theme.palette.secondary.light },
          ].map((k) => (
            <Stack key={k.label} direction="row" spacing={0.6} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: k.tone,
                  boxShadow: `0 0 6px ${k.tone}`,
                }}
              />
              <Typography sx={{ fontSize: 11, color: night.textDim }}>{k.label}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>

      {focused?.person && (
        <Box
          aria-label={`About ${focused.label}`}
          sx={{
            p: 2.5,
            borderLeft: { md: `1px solid ${alpha(night.text, 0.08)}` },
            maxHeight: { xs: '55%', md: height },
            overflowY: 'auto',
            // On a phone the panel rises over the sky; below it, it would sit off screen.
            position: { xs: 'absolute', md: 'static' },
            zIndex: 3,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: { xs: alpha(night.sky, 0.96), md: 'transparent' },
            borderTop: { xs: `1px solid ${alpha(night.text, 0.16)}`, md: 'none' },
            borderRadius: { xs: '16px 16px 0 0', md: 0 },
            backdropFilter: { xs: 'blur(6px)', md: 'none' },
          }}
        >
          <IconButton
            aria-label="Close"
            size="small"
            onClick={() => setFocus(null)}
            sx={{ float: 'right', color: night.textDim, mt: -0.75, mr: -0.75 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          <Typography
            sx={{
              fontSize: 11,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: toneOf(focused),
            }}
          >
            {focused.person.remembered
              ? `In memory${focused.person.died ? ` · ${focused.person.died.slice(0, 4)}` : ''}`
              : words.title}
          </Typography>
          <Typography
            onClick={() => onOpenProfile?.(focused.id)}
            sx={{
              fontSize: 22,
              fontWeight: 600,
              cursor: onOpenProfile ? 'pointer' : 'default',
              mt: 0.25,
            }}
          >
            {focused.label}
          </Typography>
          {meId && meId !== focused.id && (
            <Typography sx={{ fontSize: 13, color: night.textDim, mt: 0.25 }}>
              {yourRelation(relationOf(family, meId, focused.id), kind)}
            </Typography>
          )}
          {onOpenProfile && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onOpenProfile(focused.id)}
              sx={{ mt: 1.5, color: night.text, borderColor: alpha(night.text, 0.3) }}
            >
              See their page
            </Button>
          )}

          {alikeList.length > 0 && (
            <>
              <Typography
                sx={{
                  fontSize: 11,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  color: night.textDim,
                  mt: 2.5,
                  mb: 1,
                }}
              >
                Answered alike
              </Typography>
              <Stack spacing={1}>
                {alikeList.map((l) => (
                  <Box
                    key={l.other}
                    onClick={() => setFocus(l.other)}
                    sx={{
                      cursor: 'pointer',
                      p: 1.1,
                      borderRadius: 1.5,
                      bgcolor: alpha(night.text, 0.04),
                      border: `1px solid ${alpha(night.text, 0.1)}`,
                      '&:hover': { borderColor: alpha(night.text, 0.3) },
                    }}
                  >
                    <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          bgcolor: identityColor(l.other),
                        }}
                      />
                      <Typography sx={{ fontSize: 13.5, flex: 1 }} noWrap>
                        {nameOf(l.other)}
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: night.textDim }}>
                        {l.count}×
                      </Typography>
                    </Stack>
                    {l.examples[0] && (
                      <Typography sx={{ fontSize: 12, color: night.textDim, mt: 0.5 }}>
                        {l.examples[0].question}
                        <br />
                        <Box component="span" sx={{ color: night.text }}>
                          “{l.examples[0].mine}”
                        </Box>
                        {'  ·  '}
                        <Box component="span" sx={{ color: night.text }}>
                          “{l.examples[0].theirs}”
                        </Box>
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </Box>
      )}
    </Box>
  );
};
