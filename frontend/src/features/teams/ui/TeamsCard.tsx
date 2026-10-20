/**
 * Teams on Home (docs/decisions/0030), in a season played as teams: what's
 * waiting for your yes, the standings, and what you can do next (start a
 * team, team up with someone, ask to join). Any time in the season.
 */
import type { TeamsView } from '@family-trivia/shared';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { Box, Button, Card, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Face } from '../../../entities/person';
import { teamsApi } from '../api/teamsApi';

interface Actions {
  start: (name: string) => Promise<TeamsView>;
  join: (teamId: string) => Promise<TeamsView>;
  teamUp: (to: string) => Promise<TeamsView>;
  answer: (id: string, accept: boolean) => Promise<TeamsView>;
  leave: () => Promise<TeamsView>;
}

interface ViewProps {
  me: string;
  /** Everyone playing, for "team up with". */
  people: { id: string; name: string }[];
  view: TeamsView | null;
  act: Actions;
}

export const TeamsCardView: React.FC<ViewProps> = ({ me, people, view: given, act }) => {
  const [view, setView] = useState(given);
  const [name, setName] = useState('');
  const [partner, setPartner] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setView(given), [given]);
  if (!view?.on) return null;

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  const onATeam = new Set(view.teams.flatMap((t) => t.members));
  const solo = people.filter((p) => p.id !== me && !onATeam.has(p.id));
  const asked = (pred: (r: TeamsView['fromMe'][number]) => boolean) => view.fromMe.some(pred);
  const run = async (f: () => Promise<TeamsView>) => {
    setBusy(true);
    try {
      setView(await f());
    } finally {
      setBusy(false);
    }
  };
  const mine = view.teams.find((t) => t.id === view.myTeam);

  return (
    <Card sx={{ p: 2.5, mb: 2, borderRadius: 3 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 1.5 }}>
        <GroupsRoundedIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 800, flex: 1 }}>
          {mine ? mine.name : 'Teams this season'}
        </Typography>
        {mine && (
          <Button size="small" color="inherit" disabled={busy} onClick={() => void run(act.leave)}>
            Leave
          </Button>
        )}
      </Stack>

      {view.toMe.length > 0 && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {view.toMe.map((r) => (
            <Stack key={r.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Face id={r.from} name={nameOf(r.from)} size={28} />
              <Typography sx={{ flex: 1 }}>
                {r.kind === 'join'
                  ? `${nameOf(r.from)} would like to join`
                  : `${nameOf(r.from)} wants to team up with you`}
              </Typography>
              <Button
                size="small"
                disabled={busy}
                onClick={() => void run(() => act.answer(r.id, false))}
              >
                Not now
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={busy}
                onClick={() => void run(() => act.answer(r.id, true))}
              >
                Yes
              </Button>
            </Stack>
          ))}
        </Stack>
      )}

      {view.standings.length > 0 && (
        <Stack spacing={0.75} sx={{ mb: 2 }}>
          {view.standings.map((s, i) => (
            <Stack key={s.teamId} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography sx={{ width: 20, fontWeight: 800, color: 'text.secondary' }}>
                {i + 1}
              </Typography>
              <Typography sx={{ flex: 1, fontWeight: s.teamId === view.myTeam ? 800 : 600 }}>
                {s.name}
              </Typography>
              <Stack direction="row" spacing={-0.5}>
                {s.members.map((m) => (
                  <Face key={m} id={m} name={nameOf(m)} size={22} ring />
                ))}
              </Stack>
              <Typography
                variant="body2"
                sx={{ width: 64, textAlign: 'right', color: 'text.secondary' }}
              >
                {s.average} each
              </Typography>
            </Stack>
          ))}
        </Stack>
      )}

      {!mine && (
        <Stack spacing={1.5}>
          {view.teams.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {view.teams.map((t) => {
                const sent = asked((r) => r.kind === 'join' && r.teamId === t.id);
                return (
                  <Chip
                    key={t.id}
                    label={sent ? `Asked to join ${t.name}` : `Ask to join ${t.name}`}
                    variant={sent ? 'filled' : 'outlined'}
                    disabled={busy || sent}
                    onClick={() => void run(() => act.join(t.id))}
                  />
                );
              })}
            </Box>
          )}
          {solo.length > 0 && (
            <Stack direction="row" spacing={1}>
              <TextField
                select
                size="small"
                label="Team up with"
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
                sx={{ flex: 1 }}
              >
                {solo.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                    {asked((r) => r.kind === 'team-up' && r.to === p.id) ? ' (asked)' : ''}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                disabled={busy || !partner}
                onClick={() => void run(() => act.teamUp(partner)).then(() => setPartner(''))}
              >
                Ask
              </Button>
            </Stack>
          )}
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              label="Or start a team"
              placeholder="Quizzards"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              sx={{ flex: 1 }}
            />
            <Button
              variant="contained"
              disabled={busy || !name.trim()}
              onClick={() => void run(() => act.start(name)).then(() => setName(''))}
            >
              Start
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Teams rank by points per member, so a small team can win. Join any time this season.
          </Typography>
        </Stack>
      )}
    </Card>
  );
};

/** Home's card, from the server. */
export const TeamsCard: React.FC<{ me: string; people: { id: string; name: string }[] }> = ({
  me,
  people,
}) => {
  const [view, setView] = useState<TeamsView | null>(null);
  useEffect(() => {
    teamsApi
      .view()
      .then(setView)
      .catch(() => setView(null));
  }, []);
  return <TeamsCardView me={me} people={people} view={view} act={teamsApi} />;
};
