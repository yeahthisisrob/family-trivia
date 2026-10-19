/**
 * For admins, on someone's Remembering page (docs/decisions/0027): a link
 * anyone can use to add a memory of them, and the memories waiting for a yes.
 * Shows nothing to anyone who isn't an admin.
 */
import type { MemoryLink, MemoryLinkLifetime, VisitorMemory } from '@family-trivia/shared';
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { usePaper } from '../../../shared/design-system';
import { shareLink } from '../../../shared/share';
import { memoryLinksApi, memoryLinkUrl } from '../api/memoryLinksApi';

const LIFETIMES: { value: MemoryLinkLifetime; label: string }[] = [
  { value: 'month', label: 'A month' },
  { value: 'forever', label: 'No end' },
];

interface ViewProps {
  name: string;
  links: MemoryLink[];
  waiting: VisitorMemory[];
  onMake: (lifetime: MemoryLinkLifetime) => Promise<MemoryLink>;
  onRevoke: (token: string) => Promise<void>;
  onDecide: (id: string, approve: boolean) => Promise<void>;
}

export const MemoryLinkPanelView: React.FC<ViewProps> = ({
  name,
  links,
  waiting,
  onMake,
  onRevoke,
  onDecide,
}) => {
  const paper = usePaper();
  const [lifetime, setLifetime] = useState<MemoryLinkLifetime>('forever');
  const [done, setDone] = useState<string | null>(null);
  const open = links.filter(
    (l) => !l.revokedAt && (!l.expiresAt || new Date(l.expiresAt) > new Date()),
  );
  const serif = { fontFamily: paper.serif };

  const send = async (link: MemoryLink) =>
    setDone(await shareLink(memoryLinkUrl(link.token), `Remembering ${name}`));

  return (
    <Box sx={{ border: `1px solid ${paper.rule}`, borderRadius: 2, p: 2 }}>
      <Typography sx={{ ...serif, fontWeight: 700, fontSize: '1.05rem' }}>
        Ask others for memories of {name}
      </Typography>
      <Typography sx={{ ...serif, color: paper.inkSoft, fontSize: '0.95rem', mb: 1.5 }}>
        A link anyone can open, no account needed. What they share waits here for you.
      </Typography>

      {waiting.length > 0 && (
        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {waiting.map((m) => (
            <Box key={m.id} sx={{ borderLeft: `2px solid ${paper.rule}`, pl: 1.5 }}>
              <Typography sx={{ ...serif, whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
              <Typography sx={{ ...serif, color: paper.inkSoft, fontSize: '0.88rem' }}>
                {m.how ? `${m.name}, ${m.how}` : m.name}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => void onDecide(m.id, true)}
                  sx={{ ...serif, color: paper.ink, borderColor: paper.rule }}
                >
                  Let it in
                </Button>
                <Button
                  size="small"
                  onClick={() => void onDecide(m.id, false)}
                  sx={{ ...serif, color: paper.inkSoft }}
                >
                  Not this one
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {open[0] ? (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<IosShareRoundedIcon />}
            onClick={() => void send(open[0] as MemoryLink)}
            sx={{ ...serif, color: paper.ink, borderColor: paper.rule }}
          >
            {done === 'copied' ? 'Copied' : done === 'shared' ? 'Shared' : 'Share the link'}
          </Button>
          <Typography sx={{ ...serif, color: paper.inkSoft, fontSize: '0.88rem' }}>
            {open[0].uses === 1 ? '1 memory so far' : `${open[0].uses} memories so far`}
          </Typography>
          <Button
            size="small"
            onClick={() => void onRevoke((open[0] as MemoryLink).token)}
            sx={{ ...serif, color: paper.inkSoft }}
          >
            Take it back
          </Button>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          {LIFETIMES.map((l) => (
            <Chip
              key={l.value}
              label={l.label}
              variant={lifetime === l.value ? 'filled' : 'outlined'}
              onClick={() => setLifetime(l.value)}
              sx={serif}
            />
          ))}
          <Button
            variant="outlined"
            startIcon={<IosShareRoundedIcon />}
            onClick={async () => void send(await onMake(lifetime))}
            sx={{ ...serif, color: paper.ink, borderColor: paper.rule }}
          >
            Make a link
          </Button>
        </Stack>
      )}
    </Box>
  );
};

/** The panel, for admins only: hidden when the links can't be read (not an admin). */
export const MemoryLinkPanel: React.FC<{
  personId: string;
  name: string;
  onLetIn: () => void;
}> = ({ personId, name, onLetIn }) => {
  const [links, setLinks] = useState<MemoryLink[] | null>(null);
  const [waiting, setWaiting] = useState<VisitorMemory[]>([]);

  const reload = useCallback(async () => {
    const [l, v] = await Promise.all([
      memoryLinksApi.links(personId),
      memoryLinksApi.visitors(personId),
    ]);
    setLinks(l);
    setWaiting(v.filter((m) => m.status === 'waiting'));
  }, [personId]);

  useEffect(() => {
    reload().catch(() => setLinks(null));
  }, [reload]);

  if (!links) return null;
  return (
    <MemoryLinkPanelView
      name={name}
      links={links}
      waiting={waiting}
      onMake={async (lifetime) => {
        const link = await memoryLinksApi.make(personId, lifetime);
        await reload();
        return link;
      }}
      onRevoke={async (token) => {
        await memoryLinksApi.revoke(token);
        await reload();
      }}
      onDecide={async (id, approve) => {
        await memoryLinksApi.decide(personId, id, approve);
        await reload();
        if (approve) onLetIn();
      }}
    />
  );
};
