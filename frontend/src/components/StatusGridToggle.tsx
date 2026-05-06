// File: src/components/StatusGridToggle.tsx
//
// Toggle between the Facts grid and the Trivia grid on the home tab.
// Both grids show the family's answer matrix — this lets users switch
// between them without navigating to a different tab.

import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import TodayIcon from '@mui/icons-material/Today';
import { Box, ToggleButton, ToggleButtonGroup, useTheme, alpha } from '@mui/material';
import React, { useState } from 'react';

import FactStatusBar from './FactStatusBar';
import TriviaStatusBar from './TriviaCard/TriviaStatusBar';

interface StatusGridToggleProps {
  userId: string;
}

const StatusGridToggle: React.FC<StatusGridToggleProps> = ({ userId }) => {
  const theme = useTheme();
  const [view, setView] = useState<'facts' | 'trivia'>('facts');

  return (
    <Box sx={{ mb: 1.5 }}>
      {/* Toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_, v) => { if (v) setView(v); }}
          size="small"
          sx={{
            height: 30,
            '& .MuiToggleButton-root': {
              px: 1.5,
              py: 0,
              fontSize: '0.68rem',
              fontWeight: 600,
              textTransform: 'none',
              border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
              color: theme.palette.text.secondary,
              '&.Mui-selected': {
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                color: theme.palette.primary.main,
                borderColor: alpha(theme.palette.primary.main, 0.3),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                },
              },
            },
          }}
        >
          <ToggleButton value="facts">
            <TodayIcon sx={{ fontSize: 14, mr: 0.5 }} />
            Facts
          </ToggleButton>
          <ToggleButton value="trivia">
            <QuestionAnswerIcon sx={{ fontSize: 14, mr: 0.5 }} />
            Trivia
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Grid */}
      {view === 'facts' ? (
        <FactStatusBar userId={userId} />
      ) : (
        <TriviaStatusBar userId={userId} />
      )}
    </Box>
  );
};

export default StatusGridToggle;
