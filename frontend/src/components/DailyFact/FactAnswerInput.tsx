/**
 * FactAnswerInput — text input with fuzzy autocomplete via Fuse.js.
 *
 * Suggestions are common ways to start talking about memories/facts,
 * extracted from how the family naturally writes. Plus family member
 * names for quick reference.
 *
 * No individual answers shown — just helpful patterns and names.
 * Fuse.js runs client-side, sub-millisecond, instant on iPads.
 *
 * This is just the input — submit/skip buttons live in the parent
 * so they're big, clear, and labeled for older users.
 */

import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import Fuse from 'fuse.js';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';

import { getFactStarters } from '../../api/modules/facts';
import { useFamilyData } from '../../contexts/FamilyDataContext';
import { createLogger } from '../../shared/lib/logger';

const logger = createLogger('FactAnswerInput');

const FALLBACK_STARTERS = [
  'I love',
  'My favorite',
  'When I was young',
  'I remember when',
  'We used to',
];

interface Suggestion {
  text: string;
  source: 'starter' | 'name';
}

interface FactAnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  userId: string;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

const FactAnswerInput: React.FC<FactAnswerInputProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Type your answer...',
  autoFocus = false,
}) => {
  const { members } = useFamilyData();
  const [starters, setStarters] = useState<string[]>(FALLBACK_STARTERS);

  useEffect(() => {
    let cancelled = false;
    getFactStarters()
      .then((s) => {
        if (!cancelled && s.length > 0) setStarters(s);
      })
      .catch((err) => logger.error('Failed to load fact starters', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const fuse = useMemo(() => {
    const items: Suggestion[] = [
      ...starters.map((text) => ({ text, source: 'starter' as const })),
      ...members.map((m) => ({ text: m.name, source: 'name' as const })).filter((s) => s.text),
    ];
    return new Fuse(items, {
      keys: ['text'],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      minMatchCharLength: 2,
    });
  }, [members, starters]);

  const suggestions = useMemo((): Suggestion[] => {
    if (!value.trim()) {
      return starters.slice(0, 5).map((text) => ({ text, source: 'starter' }));
    }
    return fuse.search(value, { limit: 6 }).map((r) => r.item);
  }, [value, fuse, starters]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <Autocomplete<string, false, true, true>
      freeSolo
      disableClearable
      options={suggestions.map((s) => s.text)}
      inputValue={value}
      onInputChange={(_e, newValue, reason) => {
        if (reason !== 'reset') onChange(newValue);
      }}
      onChange={(_e, newValue) => {
        if (typeof newValue === 'string') onChange(newValue);
      }}
      filterOptions={(options) => options}
      renderOption={(props, option) => {
        const s = suggestions.find((s) => s.text === option);
        return (
          <Box
            component="li"
            {...props}
            sx={{
              py: 1.5,
              px: 2,
              fontSize: '1rem',
              minHeight: 48,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              '&:active': { bgcolor: 'action.selected' },
            }}
          >
            <span>{option}</span>
            {s?.source === 'name' && (
              <Typography
                component="span"
                sx={{ fontSize: '0.65rem', color: 'text.disabled', ml: 1 }}
              >
                family
              </Typography>
            )}
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          multiline
          minRows={2}
          maxRows={4}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              sx: { fontSize: '1.05rem', borderRadius: 2 },
            },
          }}
        />
      )}
      sx={{ width: '100%' }}
      slotProps={{
        listbox: {
          sx: {
            maxHeight: 240,
            '& .MuiAutocomplete-option': { borderBottom: '1px solid', borderColor: 'divider' },
          },
        },
      }}
    />
  );
};

export default FactAnswerInput;
