/**
 * The Family tab: the story first, doors into the tree, the connections and
 * the albums, today's spotlight, what we share, the people the family
 * remembers (each with their own Remembering page), and everyone. It is for looking at the family, not for doing chores in it
 * (docs/decisions/0009). Whatever opens behind a door is passed in, so this
 * feature doesn't reach into others.
 */
import type { Family, FamilyKnowledge, FamilyPerson } from '@family-trivia/shared';
import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  Dialog,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { type GraphData, graphApi, useFamily } from '../../../entities/family';
import { RememberingPage } from '../../remembering';
import { type FamilyStory, familyHomeApi } from '../api/familyHomeApi';
import { peopleFor, rememberedOf, sortForMe, spotlightOf } from '../model/people';
import { FamilyHero } from './FamilyHero';
import { InMemory } from './InMemory';
import { PeopleSection } from './PeopleSection';
import { SpotlightCard } from './SpotlightCard';
import { WhatWeShare } from './WhatWeShare';

export interface FamilyDoor {
  id: string;
  title: string;
  caption: string;
  icon: React.ReactNode;
  /** What opens, full screen. */
  render: (graph: GraphData, openPerson: (id: string) => void) => React.ReactNode;
}

export const FamilyHome: React.FC<{
  meId: string | null;
  doors?: FamilyDoor[];
  /** Someone was tapped: their profile, where their story is told. */
  onOpenPerson?: (id: string) => void;
  footer?: React.ReactNode;
}> = ({ meId, doors = [], onOpenPerson, footer }) => {
  const { family, photoUrls, error } = useFamily();
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [story, setStory] = useState<FamilyStory | null>(null);
  const [knowledge, setKnowledge] = useState<FamilyKnowledge | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [door, setDoor] = useState<FamilyDoor | null>(null);

  useEffect(() => {
    graphApi
      .get()
      .then(setGraph)
      .catch(() => setGraph({ people: [], ties: [], households: [], likenesses: [] }));
    familyHomeApi
      .story()
      .then(setStory)
      .catch(() => undefined);
    familyHomeApi
      .knowledge()
      .then(setKnowledge)
      .catch(() => undefined);
  }, []);

  const people = useMemo(
    () => (graph && family ? sortForMe(peopleFor(graph, family, meId), meId) : []),
    [graph, family, meId],
  );
  const photos = useMemo(() => photosOf(family, photoUrls), [family, photoUrls]);
  const { today, tomorrow } = useMemo(() => spotlightOf(people), [people]);
  const remembered = useMemo(() => (family ? rememberedOf(family) : []), [family]);

  if (error) return <Alert severity="warning">{error}</Alert>;
  if (!family || !graph) return <Skeleton variant="rounded" height={320} />;

  const nameOf = (id: string) => family.people[id]?.name ?? id;
  // The family's lost open here, on their Remembering page; everyone else on their profile.
  const open = (id: string) =>
    family.people[id]?.memorial || !onOpenPerson ? setOpenId(id) : onOpenPerson(id);
  const openedPerson = openId ? family.people[openId] : undefined;
  const remembering = openedPerson?.memorial ? openedPerson : null;

  return (
    <Stack spacing={3}>
      <FamilyHero
        familyName={family.name}
        story={story}
        numbers={knowledge?.stats}
        nameOf={nameOf}
      />

      {/* The ways in sit right under the story, not at the foot of the page. */}
      {doors.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gap: 1.25,
            gridTemplateColumns: {
              xs: doors.length > 1 ? '1fr 1fr' : '1fr',
              sm: `repeat(${Math.min(doors.length, 3)}, 1fr)`,
            },
          }}
        >
          {doors.map((d) => (
            <Card key={d.id} variant="outlined" sx={{ height: '100%' }}>
              <CardActionArea
                onClick={() => setDoor(d)}
                sx={{
                  p: 1.5,
                  height: '100%',
                  display: 'flex',
                  gap: 1.25,
                  justifyContent: 'flex-start',
                }}
              >
                <Box sx={{ color: 'primary.main', display: 'flex' }}>{d.icon}</Box>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{d.title}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {d.caption}
                  </Typography>
                </Box>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}

      {today && (
        <SpotlightCard
          person={today}
          next={tomorrow}
          meId={meId}
          photo={photos[today.id]}
          onOpen={open}
        />
      )}

      {knowledge && <WhatWeShare themes={knowledge.themes} nameOf={nameOf} onOpen={open} />}

      {/* Remembered people before the long list of everyone, not under it. */}
      <InMemory people={remembered} photos={photos} onOpen={open} />

      <PeopleSection people={people} meId={meId} photos={photos} onOpen={open} />

      {footer}

      {/* Someone the family has lost opens on their own page, not the everyday one. */}
      {remembering && (
        <RememberingPage
          person={remembering}
          photo={photos[remembering.id]}
          topics={knowledge?.people[remembering.id]?.top.map((t) => t.name)}
          nameOf={nameOf}
          onClose={() => setOpenId(null)}
        />
      )}

      {door && (
        <Dialog open fullScreen onClose={() => setDoor(null)} aria-label={door.title}>
          <Stack
            direction="row"
            sx={{ alignItems: 'center', px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}
          >
            <Typography variant="h6" sx={{ flex: 1, fontWeight: 800 }}>
              {door.title}
            </Typography>
            <IconButton aria-label="Close" onClick={() => setDoor(null)}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <Box sx={{ p: { xs: 1.5, sm: 3 }, overflow: 'auto' }}>{door.render(graph, open)}</Box>
        </Dialog>
      )}
    </Stack>
  );
};

function photosOf(
  family: Family | null,
  urls: Record<string, string>,
): Record<string, string | undefined> {
  if (!family) return {};
  const out: Record<string, string | undefined> = {};
  for (const p of Object.values(family.people) as FamilyPerson[]) {
    const key = p.memorial?.photo ?? p.photo;
    if (key) out[p.id] = urls[key];
  }
  return out;
}
