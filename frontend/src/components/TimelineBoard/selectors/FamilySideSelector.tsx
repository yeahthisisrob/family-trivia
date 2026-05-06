// File: src/components/TimelineBoard/selectors/FamilySideSelector.tsx
import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect, useMemo } from 'react';

import { useFamilyData } from '../../../contexts/FamilyDataContext';
import { getFamilySides } from '../../../utils/familyUtils';

interface FamilySideSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const FamilySideSelector: React.FC<FamilySideSelectorProps> = ({ value, onChange }) => {
  const theme = useTheme();
  const { hierarchyData } = useFamilyData();

  const availableSides = useMemo(() => getFamilySides(), [hierarchyData]);

  useEffect(() => {
    if (value !== 'all' && !availableSides[value]) onChange('all');
  }, [value, availableSides, onChange]);

  return (
    <Box sx={{
      display: 'flex', gap: 0.5, mb: 2,
      p: 0.5, borderRadius: 2,
      bgcolor: alpha(theme.palette.divider, 0.06),
    }}>
      {Object.values(availableSides).map((side) => {
        const isActive = value === side.id;
        return (
          <Box
            key={side.id}
            onClick={() => onChange(side.id)}
            sx={{
              flex: 1, py: 0.6, borderRadius: 1.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
              cursor: 'pointer', transition: 'all 0.2s ease',
              bgcolor: isActive ? theme.palette.background.paper : 'transparent',
              boxShadow: isActive ? `0 1px 3px ${alpha('#000', 0.08)}` : 'none',
              borderBottom: isActive ? `2px solid ${side.color}` : '2px solid transparent',
              '&:hover': !isActive ? { bgcolor: alpha(theme.palette.background.paper, 0.5) } : {},
            }}
          >
            {side.id !== 'all' && (
              <Box sx={{
                width: 8, height: 8, borderRadius: '50%',
                bgcolor: isActive ? side.color : alpha(side.color, 0.3),
                transition: 'all 0.2s',
              }} />
            )}
            <Typography sx={{
              fontSize: '0.7rem', fontWeight: isActive ? 700 : 500,
              color: isActive ? theme.palette.text.primary : theme.palette.text.secondary,
              transition: 'all 0.2s',
            }}>
              {side.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default FamilySideSelector;
