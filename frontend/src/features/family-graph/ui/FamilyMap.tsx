/**
 * Our map: what the family talks about, drawn as a night sky of territories.
 * Topics glow as labels on a wide ring, each kind of thing its own colored
 * ground; every person is a star drawn toward what they talk about, so the
 * people who love the same things gather together. Tap a topic to see who
 * talks about it and what they said; tap a person to light up their world.
 * Layout from model/buildMap.ts, drawing from model/sky.ts; it settles in
 * the same place every time.
 */
import type { FamilyKnowledge, KnowledgeKind } from '@family-trivia/shared';
import { relationOf } from '@family-trivia/shared';
import CloseIcon from '@mui/icons-material/Close';
import {
  alpha,
  Box,
  Button,
  ButtonBase,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { type GraphData, knowledgeApi } from '../../../entities/family';
import { asFamily } from '../model/buildGraph';
import { buildMap, type MapTopic, ringFor } from '../model/buildMap';
import {
  drawGlow,
  drawNebula,
  drawPill,
  drawStars,
  LabelRoom,
  starfield,
  tint,
} from '../model/sky';

type Node = {
  id: string;
  kind: 'topic' | 'person';
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
  vx?: number;
  vy?: number;
  home?: { x: number; y: number };
  topic?: MapTopic;
  name: string;
  size: number;
};
type Link = { source: string | Node; target: string | Node; strength: number };
const idOf = (e: string | Node) => (typeof e === 'string' ? e : e.id);

const STARS = starfield(900, 3000, 3000);

export const FamilyMap: React.FC<{
  data: GraphData;
  meId?: string | null;
  height?: number;
  onOpenProfile?: (personId: string) => void;
  /** For stories: skip fetching the index. */
  knowledge?: FamilyKnowledge | null;
}> = ({ data, meId, height = 600, onOpenProfile, knowledge: given }) => {
  const theme = useTheme();
  const night = theme.palette.night;
  const fg = useRef<ForceGraphMethods | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [knowledge, setKnowledge] = useState<FamilyKnowledge | null | undefined>(given);
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const room = useRef(new LabelRoom());

  useEffect(() => {
    if (given !== undefined) return;
    knowledgeApi
      .get()
      .then(setKnowledge)
      .catch(() => setKnowledge(null));
  }, [given]);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const family = useMemo(() => asFamily(data), [data]);
  const names = useMemo(() => new Map(data.people.map((p) => [p.id, p])), [data]);
  // The ring takes the view's shape; it's set once the view is measured, so it doesn't jump.
  const ring = useMemo(() => ringFor(width, height), [width, height]);
  const map = useMemo(
    () => (knowledge ? buildMap(knowledge, new Set(data.people.map((p) => p.id)), ring) : null),
    [knowledge, data, ring],
  );
  const kindTone = useMemo(() => {
    const tones = night.territories;
    const out = new Map<KnowledgeKind, string>();
    map?.regions.forEach((r, i) => {
      out.set(r.kind, tones[i % tones.length] ?? night.text);
    });
    return out;
  }, [map, night]);

  const graph = useMemo(() => {
    if (!map) return { nodes: [] as Node[], links: [] as Link[] };
    const nodes: Node[] = [
      ...map.topics.map((t) => ({
        id: t.id,
        kind: 'topic' as const,
        name: t.name,
        topic: t,
        fx: t.x,
        fy: t.y,
        x: t.x,
        y: t.y,
        size: t.weight,
      })),
      ...map.people.map((p) => {
        const who = names.get(p.id);
        return {
          id: p.id,
          kind: 'person' as const,
          name: who?.name ?? p.id,
          home: p.home,
          x: p.home.x,
          y: p.home.y,
          size: (who?.activity?.facts ?? 0) + 1,
        };
      }),
    ];
    return { nodes, links: map.links.map((l) => ({ ...l })) as Link[] };
  }, [map, names]);

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of graph.links) {
      const [a, b] = [idOf(l.source), idOf(l.target)];
      if (!m.has(a)) m.set(a, new Set());
      if (!m.has(b)) m.set(b, new Set());
      m.get(a)?.add(b);
      m.get(b)?.add(a);
    }
    return m;
  }, [graph]);
  const maxSize = useMemo(
    () => Math.max(1, ...graph.nodes.filter((n) => n.kind === 'person').map((n) => n.size)),
    [graph],
  );

  // Each person springs back toward their home; nobody overlaps.
  useEffect(() => {
    const f = fg.current;
    if (!f || !graph.nodes.length) return;
    f.d3Force('charge')?.strength?.(-14);
    f.d3Force('link')?.strength?.(0.015);
    f.d3Force('center', null);
    const people = graph.nodes.filter((n) => n.kind === 'person');
    f.d3Force('pull', (a: number) => {
      for (const n of people) {
        if (!n.home || n.x === undefined || n.y === undefined) continue;
        n.vx = (n.vx ?? 0) + (n.home.x - n.x) * 0.08 * a;
        n.vy = (n.vy ?? 0) + (n.home.y - n.y) * 0.08 * a;
      }
    });
    f.d3Force('collide', () => {
      for (let i = 0; i < people.length; i++)
        for (let j = i + 1; j < people.length; j++) {
          const a = people[i];
          const b = people[j];
          if (!a || !b || a.x === undefined || b.x === undefined) continue;
          const dx = (b.x ?? 0) - (a.x ?? 0);
          const dy = (b.y ?? 0) - (a.y ?? 0);
          const d = Math.hypot(dx, dy) || 1;
          const min = 34;
          if (d < min) {
            const push = (min - d) / d / 2;
            a.x -= dx * push;
            a.y = (a.y ?? 0) - dy * push;
            b.x += dx * push;
            b.y = (b.y ?? 0) + dy * push;
          }
        }
    });
  }, [graph]);

  // Fit the whole map as soon as it's laid out, and again once it settles.
  useEffect(() => {
    if (!graph.nodes.length) return undefined;
    const t = setTimeout(() => fg.current?.zoomToFit(0, width < 600 ? 70 : 40), 60);
    return () => clearTimeout(t);
  }, [graph]);

  const active = focus ?? hover;
  const lit = (id: string) => !active || id === active || !!neighbors.get(active)?.has(id);
  const focused = graph.nodes.find((n) => n.id === focus);
  const toneOf = (n: Node): string =>
    n.kind === 'topic'
      ? (kindTone.get(n.topic?.kind as KnowledgeKind) ?? night.text)
      : names.get(n.id)?.remembered
        ? night.remembered
        : night.text;

  if (knowledge === undefined) return <Skeleton variant="rounded" height={height} />;

  return (
    <Box
      sx={{
        display: 'grid',
        position: 'relative',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: focused ? 'minmax(0, 1fr) 300px' : '1fr' },
        bgcolor: night.sky,
        color: night.text,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box ref={box} sx={{ position: 'relative', minHeight: height, minWidth: 0 }}>
        {!map?.topics.length && (
          <Stack
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              p: 4,
              gap: 1,
            }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
              Our map fills in as the family’s answers are read
            </Typography>
            <Typography sx={{ color: night.textDim, maxWidth: 380 }}>
              The places, food and things we talk about show up here, with each of us drawn toward
              what we love. An admin starts it from Admin › Family › Read new answers.
            </Typography>
          </Stack>
        )}
        <ForceGraph2D
          ref={fg}
          width={width}
          height={height}
          graphData={graph as { nodes: object[]; links: object[] }}
          backgroundColor={night.sky}
          warmupTicks={80}
          cooldownTicks={220}
          d3VelocityDecay={0.35}
          onEngineStop={() => fg.current?.zoomToFit(600, width < 600 ? 70 : 40)}
          enableNodeDrag={false}
          onNodeClick={(n) => {
            const node = n as Node;
            setFocus(node.id === focus ? null : node.id);
          }}
          onBackgroundClick={() => setFocus(null)}
          onNodeHover={(n) => setHover(n ? (n as Node).id : null)}
          linkCurvature={0.18}
          linkColor={(l) => {
            const e = l as Link;
            const t = idOf(e.target);
            const on = !!active && (idOf(e.source) === active || t === active);
            const topic = graph.nodes.find((n) => n.id === t);
            return tint(topic ? toneOf(topic) : night.text, on ? 0.75 : active ? 0.03 : 0.12);
          }}
          linkWidth={(l) => {
            const e = l as Link;
            return active && (idOf(e.source) === active || idOf(e.target) === active) ? 1.6 : 0.7;
          }}
          linkDirectionalParticles={(l) => {
            const e = l as Link;
            return active && (idOf(e.source) === active || idOf(e.target) === active) ? 2 : 0;
          }}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => night.text}
          onRenderFramePre={(ctx, scale) => {
            room.current.reset();
            drawStars(ctx, STARS, night.text, scale);
            if (!map) return;
            // Territories: the ground under each kind, then a glow under every topic.
            drawNebula(ctx, [
              ...map.regions.map((r) => ({
                x: Math.cos(r.angle) * ring.rx * 0.85,
                y: Math.sin(r.angle) * ring.ry * 0.85,
                r: 340,
                color: kindTone.get(r.kind) ?? night.text,
                a: 0.07,
              })),
              ...map.topics.map((t) => ({
                x: t.x,
                y: t.y,
                r: 110 + t.weight * 18,
                color: kindTone.get(t.kind) ?? night.text,
                a: active && !lit(t.id) ? 0.02 : 0.09,
              })),
            ]);
            // The territories' names, quiet and behind everything, like places on a map.
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const size = 11 / scale;
            ctx.font = `700 ${size}px system-ui, sans-serif`;
            for (const r of map.regions) {
              const label = r.label.toUpperCase().split('').join(String.fromCharCode(8202));
              const w = ctx.measureText(label).width;
              if (!room.current.take(r.x - w / 2, r.y - size, w, size * 2)) continue;
              ctx.fillStyle = tint(kindTone.get(r.kind) ?? night.text, 0.55);
              ctx.fillText(label, r.x, r.y);
            }
            ctx.restore();
          }}
          nodeCanvasObjectMode={() => 'replace'}
          nodeCanvasObject={(n, ctx, scale) => {
            const node = n as Node;
            if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
            const x = node.x as number;
            const y = node.y as number;
            const on = lit(node.id);
            const tone = toneOf(node);
            if (node.kind === 'topic') {
              const size = (10.5 + Math.min(node.size, 6) * 0.9) / scale;
              ctx.globalAlpha = on ? 1 : 0.25;
              drawPill(
                ctx,
                node.name,
                x,
                y,
                size,
                tone,
                alpha(night.sky, 0.82),
                room.current,
                node.id === active,
              );
              ctx.globalAlpha = 1;
              return;
            }
            const r = 3 + Math.sqrt(node.size / maxSize) * 5 + (node.id === focus ? 1.5 : 0);
            drawGlow(ctx, x, y, r, tone, on ? 1 : 0.22);
            if (names.get(node.id)?.remembered) {
              ctx.strokeStyle = tint(night.halo, 0.85);
              ctx.lineWidth = 1 / scale;
              ctx.beginPath();
              ctx.arc(x, y, r + 2.5, 0, Math.PI * 2);
              ctx.stroke();
            }
            if (node.id === meId) {
              ctx.strokeStyle = night.text;
              ctx.lineWidth = 1.4 / scale;
              ctx.beginPath();
              ctx.arc(x, y, r + 1.6, 0, Math.PI * 2);
              ctx.stroke();
            }
            // Names by importance: the focused and hovered always, the rest as you zoom.
            const important = node.id === active || node.id === meId;
            if (!on || (!important && scale < 0.55)) return;
            const size = (important ? 13 : 11) / scale;
            ctx.font = `${important ? 700 : 500} ${size}px system-ui, sans-serif`;
            const w = ctx.measureText(node.name).width;
            const ty = y + r + 3 / scale;
            if (!room.current.take(x - w / 2, ty, w, size * 1.2) && !important) return;
            ctx.fillStyle = tint(night.text, important ? 0.95 : 0.75);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(node.name, x, ty);
          }}
          nodePointerAreaPaint={(n, color, ctx, scale) => {
            const node = n as Node;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(
              node.x as number,
              node.y as number,
              (node.kind === 'topic' ? 22 : 12) / Math.sqrt(scale),
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }}
        />
      </Box>

      {focused && (
        <Box
          aria-label={`About ${focused.name}`}
          sx={{
            p: 2.5,
            borderLeft: { md: `1px solid ${alpha(night.text, 0.08)}` },
            maxHeight: { xs: '60%', md: height },
            overflowY: 'auto',
            position: { xs: 'absolute', md: 'static' },
            zIndex: 3,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: { xs: alpha(night.sky, 0.96), md: 'transparent' },
            borderTop: { xs: `1px solid ${alpha(night.text, 0.16)}`, md: 'none' },
            borderRadius: { xs: '16px 16px 0 0', md: 0 },
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
          {focused.kind === 'topic' && focused.topic ? (
            <TopicPanel
              topic={focused.topic}
              tone={toneOf(focused)}
              nameOf={(id) => names.get(id)?.name ?? id}
              onPerson={setFocus}
            />
          ) : (
            <Stack spacing={1.25}>
              <Typography sx={{ fontSize: 22, fontWeight: 700 }}>{focused.name}</Typography>
              {meId && meId !== focused.id && (
                <Typography sx={{ fontSize: 13, color: night.textDim }}>
                  {(() => {
                    const r = relationOf(family, meId, focused.id);
                    return r ? `Your ${r}` : 'In your family';
                  })()}
                </Typography>
              )}
              <Typography
                sx={{
                  fontSize: 11,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  color: night.textDim,
                  pt: 1,
                }}
              >
                Talks about
              </Typography>
              <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                {[...(neighbors.get(focused.id) ?? [])].map((t) => {
                  const topic = graph.nodes.find((n) => n.id === t);
                  if (!topic) return null;
                  return (
                    <Chip
                      key={t}
                      size="small"
                      label={topic.name}
                      onClick={() => setFocus(t)}
                      sx={{
                        color: toneOf(topic),
                        border: `1px solid ${alpha(toneOf(topic), 0.5)}`,
                        bgcolor: 'transparent',
                      }}
                    />
                  );
                })}
                {!neighbors.get(focused.id)?.size && (
                  <Typography sx={{ fontSize: 13, color: night.textDim }}>
                    Nothing on the map yet.
                  </Typography>
                )}
              </Stack>
              {onOpenProfile && (
                <Box>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onOpenProfile(focused.id)}
                    sx={{ mt: 1, color: night.text, borderColor: alpha(night.text, 0.3) }}
                  >
                    See their page
                  </Button>
                </Box>
              )}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
};

const TopicPanel: React.FC<{
  topic: MapTopic;
  tone: string;
  nameOf: (id: string) => string;
  onPerson: (id: string) => void;
}> = ({ topic, tone, nameOf, onPerson }) => {
  const night = useTheme().palette.night;
  return (
    <Stack spacing={1.25}>
      <Typography sx={{ fontSize: 22, fontWeight: 700, color: tone }}>{topic.name}</Typography>
      <Typography sx={{ fontSize: 13, color: night.textDim }}>
        {topic.people.length === 1
          ? `${nameOf(topic.people[0] ?? '')} talks about it`
          : `${topic.people.length} of us talk about it`}
      </Typography>
      <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
        {topic.people.map((p) => (
          <Chip
            key={p}
            size="small"
            label={nameOf(p)}
            onClick={() => onPerson(p)}
            sx={{ color: night.text, bgcolor: alpha(night.text, 0.08) }}
          />
        ))}
      </Stack>
      {topic.quotes.length > 0 && (
        <Stack spacing={1} sx={{ pt: 1 }}>
          {topic.quotes.map((q) => (
            <ButtonBase
              key={`${q.personId}${q.says}`}
              onClick={() => onPerson(q.personId)}
              sx={{
                display: 'block',
                textAlign: 'left',
                p: 1.1,
                borderRadius: 1.5,
                bgcolor: alpha(night.text, 0.04),
                border: `1px solid ${alpha(night.text, 0.1)}`,
              }}
            >
              <Typography sx={{ fontSize: 14, fontStyle: 'italic' }}>“{q.says}”</Typography>
              <Typography sx={{ fontSize: 12, color: night.textDim }}>
                {nameOf(q.personId)}
              </Typography>
            </ButtonBase>
          ))}
        </Stack>
      )}
    </Stack>
  );
};
