/**
 * A person's direct connections: partners, parents, children, and kinship
 * stated outright. Everything else (siblings, cousins, in-laws) is worked
 * out from these, so it's shown read-only as "Also in the family".
 */

import {
  type DeclaredKin,
  type Family,
  type ParentKind,
  type PartnerKind,
  type PartnershipEnd,
  relationOf,
  type Tie,
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

type NewKind = 'partner' | 'parent' | 'child' | 'kin';

const PARTNER: Record<PartnerKind, string> = {
  married: 'Married',
  partnered: 'Partners',
  engaged: 'Engaged',
};
const ENDED: Record<PartnershipEnd, string> = {
  separated: 'Separated',
  divorced: 'Divorced',
  widowed: 'Widowed',
};
const PARENT: Record<ParentKind, string> = {
  birth: 'Parent',
  adoptive: 'Adoptive parent',
  step: 'Stepparent',
  foster: 'Foster parent',
  guardian: 'Guardian',
};
const KIN: Record<DeclaredKin, string> = {
  sibling: 'Sibling',
  cousin: 'Cousin',
  'aunt-uncle': 'Aunt or uncle of',
  grandparent: 'Grandparent of',
  'in-law': 'In-law',
  'chosen-family': 'Chosen family',
  friend: 'Friend',
};

const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface TieListProps {
  family: Family;
  personId: string;
  ties: Tie[];
  onChange: (ties: Tie[]) => void;
}

export const TieList: React.FC<TieListProps> = ({ family, personId, ties, onChange }) => {
  const name = (id: string) => family.people[id]?.name ?? id;
  const mine = ties.filter((t) =>
    (t.type === 'parent' ? [t.parent, t.child] : [t.a, t.b]).includes(personId),
  );
  const update = (id: string, next: Tie) => onChange(ties.map((t) => (t.id === id ? next : t)));
  const remove = (id: string) => onChange(ties.filter((t) => t.id !== id));

  const others = Object.values(family.people).filter((p) => p.id !== personId);
  const [kind, setKind] = useState<NewKind>('partner');
  const [other, setOther] = useState('');

  const add = () => {
    if (!other) return;
    const id = newId();
    const tie: Tie =
      kind === 'partner'
        ? { id, type: 'partner', a: personId, b: other, kind: 'partnered' }
        : kind === 'parent'
          ? { id, type: 'parent', parent: other, child: personId, kind: 'birth' }
          : kind === 'child'
            ? { id, type: 'parent', parent: personId, child: other, kind: 'birth' }
            : { id, type: 'kin', a: personId, b: other, relation: 'cousin' };
    onChange([...ties, tie]);
    setOther('');
  };

  const derived = others
    .map((p) => ({ p, rel: relationOf({ ...family, ties }, personId, p.id) }))
    .filter(
      (x) =>
        x.rel &&
        !mine.some((t) =>
          (t.type === 'parent' ? [t.parent, t.child] : [t.a, t.b]).includes(x.p.id),
        ),
    );

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Connections
      </Typography>
      <Stack spacing={1}>
        {mine.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No direct connections yet. Add a partner, a parent or a child below.
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
                  {Object.entries(PARTNER).map(([v, l]) => (
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
                  {Object.entries(ENDED).map(([v, l]) => (
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
                  {Object.entries(PARENT).map(([v, l]) => (
                    <MenuItem key={v} value={v}>
                      {l}
                    </MenuItem>
                  ))}
                </TextField>
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
                  {Object.entries(KIN).map(([v, l]) => (
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
          onChange={(e) => setKind(e.target.value as NewKind)}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="partner">A partner</MenuItem>
          <MenuItem value="parent">A parent</MenuItem>
          <MenuItem value="child">A child</MenuItem>
          <MenuItem value="kin">Other family</MenuItem>
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
            Also in the family (worked out from the connections above)
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
            {derived.map(({ p, rel }) => (
              <Chip key={p.id} size="small" variant="outlined" label={`${p.name}: ${rel}`} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};
