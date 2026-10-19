import {
  type Invite,
  type InviteLifetime,
  inviteState,
  type PendingJoin,
} from '@family-trivia/shared';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { inviteLink } from '../api/invitesApi';
import { useInvites } from '../model/useInvites';

export interface InvitePerson {
  id: string;
  name: string;
  /** Has played at least once, so they're probably signed in already. */
  joined: boolean;
}

const LIFETIMES: { value: InviteLifetime; label: string }[] = [
  { value: 'day', label: 'A day' },
  { value: 'week', label: 'A week' },
  { value: 'month', label: 'A month' },
  { value: 'forever', label: 'No end' },
];

/** Copy the link, or hand it to the phone's share sheet when there is one. */
async function share(link: string, circleName: string): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    try {
      await navigator.share({ title: `Join ${circleName}`, url: link });
      return 'shared';
    } catch {
      /* closed the sheet: copy instead */
    }
  }
  await navigator.clipboard.writeText(link);
  return 'copied';
}

interface Props {
  circleName: string;
  people: InvitePerson[];
}

/**
 * Admin › Circles › Invites: make a link (for anyone, or someone already
 * added), share it, see who used it, and let waiting people in.
 */
export const InvitesAdmin: React.FC<Props> = ({ circleName, people }) => {
  const { invites, joins, loaded, create, revoke, decide } = useInvites();
  const [made, setMade] = useState<Invite | null>(null);

  return (
    <Stack spacing={2}>
      {joins.length > 0 && <Waiting joins={joins} onDecide={decide} />}
      <MakeLink
        circleName={circleName}
        people={people}
        made={made}
        onMake={async (i) => setMade(await create(i))}
      />
      {loaded && invites.length > 0 && (
        <Links invites={invites} people={people} circleName={circleName} onRevoke={revoke} />
      )}
    </Stack>
  );
};

const Waiting: React.FC<{ joins: PendingJoin[]; onDecide: (id: string, yes: boolean) => void }> = ({
  joins,
  onDecide,
}) => (
  <Card sx={{ p: 2, borderRadius: 3, borderLeft: 4, borderColor: 'secondary.main' }}>
    <Typography sx={{ fontWeight: 700, mb: 1 }}>
      {joins.length === 1
        ? 'Someone is waiting to join'
        : `${joins.length} people are waiting to join`}
    </Typography>
    <Stack spacing={1.25}>
      {joins.map((j) => (
        <Box key={j.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600 }}>{j.details.name}</Typography>
            <Typography noWrap sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
              {[j.details.howWeMet, j.email].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          <Button size="small" onClick={() => onDecide(j.id, false)}>
            Not now
          </Button>
          <Button size="small" variant="contained" onClick={() => onDecide(j.id, true)}>
            Let in
          </Button>
        </Box>
      ))}
    </Stack>
  </Card>
);

const MakeLink: React.FC<{
  circleName: string;
  people: InvitePerson[];
  made: Invite | null;
  onMake: (i: {
    forUserId?: string;
    lifetime: InviteLifetime;
    maxUses: number | null;
    approval: boolean;
  }) => Promise<void>;
}> = ({ circleName, people, made, onMake }) => {
  const [who, setWho] = useState<'anyone' | 'person'>('anyone');
  const [personId, setPersonId] = useState('');
  const [lifetime, setLifetime] = useState<InviteLifetime>('week');
  const [onePerson, setOnePerson] = useState(false);
  const [approval, setApproval] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sorted = [...people].sort(
    (a, b) => Number(a.joined) - Number(b.joined) || a.name.localeCompare(b.name),
  );

  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      await onMake({
        ...(who === 'person' ? { forUserId: personId } : {}),
        lifetime,
        maxUses: onePerson ? 1 : null,
        approval,
      });
    } catch {
      setError("Couldn't make the link. Please try again.");
    }
    setBusy(false);
  };

  return (
    <Card sx={{ p: 2.5, borderRadius: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Invite people to {circleName}
      </Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem', mb: 2 }}>
        Send a link. They sign in with Google and they're in. No passphrase needed.
      </Typography>

      <Stack spacing={2}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={who}
          onChange={(_, v) => v && setWho(v)}
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600 } }}
        >
          <ToggleButton value="anyone">Anyone with the link</ToggleButton>
          <ToggleButton value="person">Someone you've added</ToggleButton>
        </ToggleButtonGroup>

        {who === 'person' && (
          <TextField
            select
            fullWidth
            size="small"
            label="Who is it for?"
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
          >
            {sorted.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
                {!p.joined && (
                  <Typography
                    component="span"
                    sx={{ ml: 1, color: 'text.secondary', fontSize: '0.8rem' }}
                  >
                    hasn't joined yet
                  </Typography>
                )}
              </MenuItem>
            ))}
          </TextField>
        )}

        <Box>
          <Typography
            sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary', mb: 0.75 }}
          >
            Link works for
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {LIFETIMES.map((l) => (
              <Chip
                key={l.value}
                label={l.label}
                color={lifetime === l.value ? 'primary' : 'default'}
                variant={lifetime === l.value ? 'filled' : 'outlined'}
                onClick={() => setLifetime(l.value)}
              />
            ))}
          </Box>
        </Box>

        {who === 'anyone' && (
          <Box>
            <FormControlLabel
              control={
                <Switch checked={onePerson} onChange={(e) => setOnePerson(e.target.checked)} />
              }
              label="Only one person can use it"
            />
            <FormControlLabel
              control={
                <Switch checked={approval} onChange={(e) => setApproval(e.target.checked)} />
              }
              label="I'll let each person in"
            />
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}

        <Button
          variant="contained"
          size="large"
          startIcon={<LinkRoundedIcon />}
          disabled={busy || (who === 'person' && !personId)}
          onClick={() => void make()}
        >
          Make link
        </Button>

        {made && <MadeLink invite={made} circleName={circleName} />}
      </Stack>
    </Card>
  );
};

const MadeLink: React.FC<{ invite: Invite; circleName: string }> = ({ invite, circleName }) => {
  const link = inviteLink(invite.token);
  const [done, setDone] = useState<'shared' | 'copied' | null>(null);
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'action.hover',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Typography noWrap sx={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}>
        {link}
      </Typography>
      <Button
        variant="contained"
        color="secondary"
        startIcon={done ? <CheckRoundedIcon /> : <IosShareRoundedIcon />}
        onClick={async () => setDone(await share(link, circleName))}
      >
        {done === 'copied' ? 'Copied' : done === 'shared' ? 'Shared' : 'Share'}
      </Button>
    </Box>
  );
};

const STATE_LABEL = { open: 'Open', expired: 'Expired', 'used-up': 'Used', revoked: 'Taken back' };

const Links: React.FC<{
  invites: Invite[];
  people: InvitePerson[];
  circleName: string;
  onRevoke: (token: string) => void;
}> = ({ invites, people, circleName, onRevoke }) => {
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;
  return (
    <Card sx={{ p: 2, borderRadius: 3 }}>
      <Typography sx={{ fontWeight: 700, mb: 1 }}>Links</Typography>
      <Stack spacing={1}>
        {invites.map((i) => {
          const state = inviteState(i);
          const open = state === 'open';
          return (
            <Box key={i.token} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {i.for.kind === 'person' ? `For ${nameOf(i.for.userId)}` : 'Anyone with the link'}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                  {i.uses === 1 ? 'Used once' : `Used ${i.uses} times`}
                  {i.expiresAt && open && ` · until ${new Date(i.expiresAt).toLocaleDateString()}`}
                  {i.approval && ' · you let each in'}
                </Typography>
              </Box>
              <Chip size="small" label={STATE_LABEL[state]} color={open ? 'success' : 'default'} />
              {open && (
                <>
                  <Tooltip title="Copy or share">
                    <IconButton
                      size="small"
                      onClick={() => void share(inviteLink(i.token), circleName)}
                    >
                      <ContentCopyRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Button size="small" color="inherit" onClick={() => onRevoke(i.token)}>
                    Take back
                  </Button>
                </>
              )}
            </Box>
          );
        })}
      </Stack>
    </Card>
  );
};
