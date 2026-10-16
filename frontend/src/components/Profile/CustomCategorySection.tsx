// File: components/Profile/CustomCategorySection.tsx
import StarsIcon from '@mui/icons-material/Stars';
import { Box, Chip, Divider, Paper, Typography, useTheme } from '@mui/material';
import type React from 'react';

import type { CustomCategory } from '../../api';
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
                <Typography
                  variant="subtitle1"
                  color="secondary"
                  sx={{
                    fontWeight: 'bold',
                  }}
                >
                  {customCategory.title}
                </Typography>
                <Chip
                  label="NEW"
                  color="error"
                  size="small"
                  sx={{ ml: 1, fontSize: '0.65rem', height: 20 }}
                />
              </Box>

              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                }}
              >
                {appStrings.customCategoryCreated(formatDate(customCategory.createdAt))}
              </Typography>
            </Box>

            <Typography
              variant="body2"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                maxWidth: '100%',
                marginBottom: '16px',
              }}
            >
              {customCategory.description}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
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
            <Typography
              variant="body1"
              sx={{
                marginBottom: '16px',
              }}
            >
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
