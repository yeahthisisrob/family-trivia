// File: components/Profile/CustomCategorySection.tsx
import StarsIcon from '@mui/icons-material/Stars';
import { Typography, Box, Paper, Divider, useTheme, Chip } from '@mui/material';
import React from 'react';

import { CustomCategory } from '../../api';
import appStrings from '../../constants/strings';
import CreateCustomCategoryButton from '../common/CreateCustomCategoryButton';

interface CustomCategorySectionProps {
  customCategory: CustomCategory | null;
  isCurrentUser: boolean;
  onCreateCategory: () => void;
}

const CustomCategorySection: React.FC<CustomCategorySectionProps> = ({
  customCategory,
  isCurrentUser,
  onCreateCategory,
}) => {
  const theme = useTheme();

  // Format date string to a readable format
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Paper
      elevation={2}
      sx={{
        borderRadius: 3,
        overflow: 'hidden',
        mb: 3,
      }}
    >
      <Box
        sx={{
          p: 2,
          bgcolor: theme.palette.secondary.main,
          color: theme.palette.secondary.contrastText,
        }}
      >
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StarsIcon />
          {appStrings.customTriviaCategory}
        </Typography>
      </Box>

      <Box sx={{ p: 3 }}>
        {customCategory ? (
          <>
            <Box sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  mb: 0.5,
                }}
              >
                <Typography variant="subtitle1" fontWeight="bold" color="secondary">
                  {customCategory.title}
                </Typography>
                <Chip
                  label="NEW"
                  color="error"
                  size="small"
                  sx={{ ml: 1, fontSize: '0.65rem', height: 20 }}
                />
              </Box>

              <Typography variant="caption" color="text.secondary">
                {appStrings.customCategoryCreated(formatDate(customCategory.createdAt))}
              </Typography>
            </Box>

            <Typography
              variant="body2"
              paragraph
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                maxWidth: '100%',
              }}
            >
              {customCategory.description}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="body2" color="text.secondary">
              {appStrings.customCategoryWeeklyLimit}
            </Typography>

            {isCurrentUser && (
              <CreateCustomCategoryButton
                onCreateCustomCategory={onCreateCategory}
                variant="outlined"
                icon="add"
                label={appStrings.createNewCategory}
                withContainer={false}
                sx={{ mt: 2 }}
              />
            )}
          </>
        ) : (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="body1" paragraph>
              {isCurrentUser
                ? appStrings.noCustomCategoryYet.self
                : appStrings.noCustomCategoryYet.other}
            </Typography>

            {isCurrentUser && (
              <CreateCustomCategoryButton
                onCreateCustomCategory={onCreateCategory}
                variant="contained"
                icon="add"
                label={appStrings.createCustomCategory}
                withContainer={false}
              />
            )}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default CustomCategorySection;
