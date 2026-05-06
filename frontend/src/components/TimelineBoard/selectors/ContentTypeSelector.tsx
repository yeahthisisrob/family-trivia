// File: src/components/TimelineBoard/selectors/ContentTypeSelector.tsx
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import QuizIcon from '@mui/icons-material/Quiz';
import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';

export const CONTENT_TYPES = {
  funFacts: { id: 'funFacts', label: 'Facts', icon: AutoStoriesIcon },
  triviaHistory: { id: 'triviaHistory', label: 'Trivia', icon: QuizIcon },
  comments: { id: 'comments', label: 'Comments', icon: ChatBubbleOutlineIcon },
};

export type ContentType = keyof typeof CONTENT_TYPES;

interface ContentTypeSelectorProps {
  value: ContentType;
  onChange: (value: ContentType) => void;
  sx?: React.CSSProperties;
}

const ContentTypeSelector: React.FC<ContentTypeSelectorProps> = ({ value, onChange }) => {
  const theme = useTheme();

  return (
    <Box sx={{
      display: 'flex', gap: 0.5, mb: 2,
      p: 0.5, borderRadius: 2,
      bgcolor: alpha(theme.palette.divider, 0.08),
    }}>
      {Object.values(CONTENT_TYPES).map((type) => {
        const isActive = value === type.id;
        const Icon = type.icon;
        return (
          <Box
            key={type.id}
            onClick={() => onChange(type.id as ContentType)}
            sx={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 0.5, py: 0.75, borderRadius: 1.5, cursor: 'pointer',
              transition: 'all 0.2s ease',
              bgcolor: isActive ? theme.palette.background.paper : 'transparent',
              boxShadow: isActive ? `0 1px 3px ${alpha('#000', 0.1)}` : 'none',
              '&:hover': !isActive ? { bgcolor: alpha(theme.palette.background.paper, 0.5) } : {},
            }}
          >
            <Icon sx={{
              fontSize: 16,
              color: isActive ? theme.palette.primary.main : theme.palette.text.disabled,
              transition: 'color 0.2s',
            }} />
            <Typography sx={{
              fontSize: '0.75rem', fontWeight: isActive ? 700 : 500,
              color: isActive ? theme.palette.text.primary : theme.palette.text.secondary,
              transition: 'all 0.2s',
            }}>
              {type.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

export default ContentTypeSelector;
