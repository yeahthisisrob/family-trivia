// Component for casino rush banner
import CasinoIcon from '@mui/icons-material/Casino';
import { Box, Chip, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';

interface CasinoRushBannerProps {
  failed?: boolean;
}

const CasinoRushBanner: React.FC<CasinoRushBannerProps> = ({ failed = false }) => {
  const theme = useTheme();
  const bannerColor = theme.palette.warning.main;

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
        justifyContent: 'space-between',
        zIndex: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
        <CasinoIcon sx={{ fontSize: { xs: '1rem', sm: '1.2rem' } }} />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 'bold',
            fontSize: { xs: '0.7rem', sm: '0.8rem' },
          }}
        >
          CASINO RUSH MODE
        </Typography>
      </Box>
      <Chip
        label={failed ? 'BUSTED' : 'COMPLETED'}
        size="small"
        sx={{
          bgcolor: failed ? theme.palette.error.main : theme.palette.success.main,
          color: 'white',
          fontWeight: 'bold',
          height: { xs: 18, sm: 20 },
          fontSize: { xs: '0.55rem', sm: '0.6rem' },
        }}
      />
    </Box>
  );
};

export default CasinoRushBanner;
