/**
 * A person's direct connections: friends, partners, parents, children, and
 * kinship stated outright. Everything else (siblings, cousins, in-laws) is
 * worked out from these, so it's shown read-only underneath. Which ties are
 * offered comes from the tie registry (docs/decisions/0021).
 */

import {
  type DeclaredKin,
  ENDED_LABEL,
  type Family,
  KIN_LABEL,
  MET_LABEL,
  type MetHow,
  newTie,
  PARENT_LABEL,
  PARTNER_LABEL,
  type ParentKind,
  type PartnerKind,
  type PartnershipEnd,
  relationOf,
  relationWord,
  type Tie,
  type TieChoice,
  tieChoicesFor,
  tieTouches,
} from '@family-trivia/shared';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { useCircleWords } from '../../../entities/circle';

const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface TieListProps {
  family: Family;
  personId: string;
  ties: Tie[];
  onChange: (ties: Tie[]) => void;
}

export const TieList: React.FC<TieListProps> = ({ family, personId, ties, onChange }) => {
  const { kind: circleKind, words } = useCircleWords();
  const choices = tieChoicesFor(circleKind);
  const name = (id: string) => family.people[id]?.name ?? id;
  const mine = ties.filter((t) => tieTouches(t, personId));
  const update = (id: string, next: Tie) => onChange(ties.map((t) => (t.id === id ? next : t)));
  const remove = (id: string) => onChange(ties.filter((t) => t.id !== id));

  const others = Object.values(family.people).filter((p) => p.id !== personId);
  const [kind, setKind] = useState<TieChoice>(choices[0]?.id ?? 'partner');
  const [other, setOther] = useState('');

  const add = () => {
    if (!other) return;
    onChange([...ties, newTie(kind, personId, other, newId())]);
    setOther('');
  };

  const derived = others
    .map((p) => ({ p, rel: relationOf({ ...family, ties }, personId, p.id) }))
    .filter((x) => x.rel && !mine.some((t) => tieTouches(t, x.p.id)));

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Connections
      </Typography>
      <Stack spacing={1}>
        {mine.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No direct connections yet. Add one below.
          </Typography>
        )}
        {mine.map((t) => (
          <Stack
            key={t.id}
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ alignItems: { sm: 'center' } }}
          >
            {t.type === 'partner' && (
              <>
                <Typography sx={{ minWidth: 140 }}>{name(t.a === personId ? t.b : t.a)}</Typography>
                <TextField
                  select
                  size="small"
                  label="Partnership"
                  value={t.kind}
                  onChange={(e) => update(t.id, { ...t, kind: e.target.value as PartnerKind })}
                  sx={{ minWidth: 140 }}
                >
                  {Object.entries(PARTNER_LABEL).map(([v, l]) => (
                    <MenuItem key={v} value={v}>
                      {l}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Now"
                  value={t.ended?.reason ?? 'current'}
                  onChange={(e) =>
                    update(t.id, {
                      ...t,
                      ended:
                        e.target.value === 'current'
                          ? undefined
                          : { ...t.ended, reason: e.target.value as PartnershipEnd },
                    })
                  }
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value="current">Together</MenuItem>
                  {Object.entries(ENDED_LABEL).map(([v, l]) => (
                    <MenuItem key={v} value={v}>
                      {l}
                    </MenuItem>
                  ))}
                </TextField>
                {t.ended && (
                  <TextField
                    size="small"
                    label="Since"
                    placeholder="YYYY"
                    value={t.ended.date ?? ''}
                    onChange={(e) =>
                      t.ended &&
                      update(t.id, {
                        ...t,
                        ended: { reason: t.ended.reason, date: e.target.value || undefined },
                      })
                    }
                    sx={{ width: 110 }}
                  />
                )}
              </>
            )}
            {t.type === 'parent' && (
              <>
                <Typography sx={{ minWidth: 140 }}>
                  {t.child === personId
                    ? `${name(t.parent)} is their`
                    : `Parent of ${name(t.child)}:`}
                </Typography>
                <TextField
                  select
                  size="small"
                  label="As"
                  value={t.kind}
                  onChange={(e) => update(t.id, { ...t, kind: e.target.value as ParentKind })}
                  sx={{ minWidth: 170 }}
                >
                  {Object.entries(PARENT_LABEL).map(([v, l]) => (
                    <MenuItem key={v} value={v}>
                      {l}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}
            {t.type === 'friend' && (
              <>
                <Typography sx={{ minWidth: 140 }}>{name(t.a === personId ? t.b : t.a)}</Typography>
                <TextField
                  select
                  size="small"
                  label="Met"
                  value={t.met?.how ?? ''}
                  onChange={(e) =>
                    update(t.id, {
                      ...t,
                      met: { ...t.met, how: (e.target.value || undefined) as MetHow | undefined },
                    })
                  }
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="">
                    <em>Not said</em>
                  </MenuItem>
                  {Object.entries(MET_LABEL).map(([v, l]) => (
                    <MenuItem key={v} value={v}>
                      {l}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label="When"
                  placeholder="YYYY"
                  value={t.met?.when ?? ''}
                  onChange={(e) =>
                    update(t.id, { ...t, met: { ...t.met, when: e.target.value || undefined } })
                  }
                  sx={{ width: 100 }}
                />
                <TextField
                  size="small"
                  label="Where"
                  value={t.met?.where ?? ''}
                  onChange={(e) =>
                    update(t.id, { ...t, met: { ...t.met, where: e.target.value || undefined } })
                  }
                  sx={{ minWidth: 140 }}
                />
              </>
            )}
            {t.type === 'kin' && (
              <>
                <Typography sx={{ minWidth: 140 }}>{name(t.a === personId ? t.b : t.a)}</Typography>
                <TextField
                  select
                  size="small"
                  label={
                    t.a === personId
                      ? `${family.people[personId]?.name ?? 'They'} is`
                      : `${name(t.a)} is`
                  }
                  value={t.relation}
                  onChange={(e) => update(t.id, { ...t, relation: e.target.value as DeclaredKin })}
                  sx={{ minWidth: 170 }}
                >
                  {Object.entries(KIN_LABEL).map(([v, l]) => (
                    <MenuItem key={v} value={v}>
                      {l}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}
            <IconButton size="small" aria-label="Remove connection" onClick={() => remove(t.id)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ mt: 2, alignItems: { sm: 'center' } }}
      >
        <TextField
          select
          size="small"
          label="Add"
          value={kind}
          onChange={(e) => setKind(e.target.value as TieChoice)}
          sx={{ minWidth: 150 }}
        >
          {choices.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Who"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {others.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
        <Button onClick={add} disabled={!other}>
          Add
        </Button>
      </Stack>

      {derived.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {words.derived} (worked out from the connections above)
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
            {derived.map(({ p, rel }) => (
              <Chip
                key={p.id}
                size="small"
                variant="outlined"
                label={`${p.name}: ${relationWord(rel ?? '', circleKind)}`}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};
