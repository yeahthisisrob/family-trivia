// Component for custom category banner
import StarsIcon from '@mui/icons-material/Stars';
import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';

interface CustomCategoryBannerProps {
  text?: string;
}

const CustomCategoryBanner: React.FC<CustomCategoryBannerProps> = ({
  text = 'CUSTOM CATEGORY',
}) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const theme = useTheme();
  const bannerColor = '#9C27B0'; // Purple for custom categories

  return (
    <Box
      sx={{
        position: 'absolute',
        top: -8,
        left: -8,
        right: -8,
        bgcolor: bannerColor,
        color: 'white',
        py: { xs: 0.3, sm: 0.5 },
        px: { xs: 1, sm: 1.5 },
        borderRadius: '8px 8px 0 0',
        boxShadow: `0 2px 8px ${alpha(bannerColor, 0.3)}`,
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 0.5, sm: 1 },
        zIndex: 1,
      }}
    >
      <StarsIcon sx={{ fontSize: { xs: '1rem', sm: '1.2rem' } }} />
      <Typography
        variant="caption"
        sx={{
          fontWeight: 'bold',
          fontSize: { xs: '0.7rem', sm: '0.8rem' },
        }}
      >
        {text}
      </Typography>
    </Box>
  );
};

export default CustomCategoryBanner;
