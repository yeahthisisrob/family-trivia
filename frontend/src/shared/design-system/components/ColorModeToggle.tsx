/**
 * Sun and moon: switch between light and dark. The first press leaves
 * "follow the device" for the opposite of what's showing, and the choice is
 * remembered on this device (ColorModeProvider).
 */
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { IconButton, type SxProps, type Theme, Tooltip } from '@mui/material';
import type React from 'react';
import { useColorMode } from './ColorModeProvider';

export const ColorModeToggle: React.FC<{ sx?: SxProps<Theme> }> = ({ sx }) => {
  const { resolved: showing, setMode } = useColorMode();
  const next = showing === 'dark' ? 'light' : 'dark';
  return (
    <Tooltip title={next === 'dark' ? 'Dark mode' : 'Light mode'}>
      <IconButton
        size="small"
        onClick={() => setMode(next)}
        aria-label={`Switch to ${next} mode`}
        sx={sx}
      >
        {showing === 'dark' ? (
          <LightModeOutlinedIcon sx={{ fontSize: 18 }} />
        ) : (
          <DarkModeOutlinedIcon sx={{ fontSize: 18 }} />
        )}
      </IconButton>
    </Tooltip>
  );
};
