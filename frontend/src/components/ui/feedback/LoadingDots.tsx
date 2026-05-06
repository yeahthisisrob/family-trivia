import { keyframes } from '@emotion/react';
import { Box, useTheme } from '@mui/material';
import React from 'react';

const wave = keyframes`
  0%, 60%, 100% {
    transform: translateY(0) scale(1);
    opacity: 0.35;
  }
  30% {
    transform: translateY(-7px) scale(1.2);
    opacity: 1;
  }
`;

const pulse = keyframes`
  0%, 60%, 100% {
    transform: scale(1);
    opacity: 0.4;
  }
  30% {
    transform: scale(1.3);
    opacity: 1;
  }
`;

export interface LoadingDotsProps {
  /** Dot size in px. Defaults to 8. */
  size?: number;
  /** Gap between dots in px. Defaults to size * 0.75. */
  gap?: number;
  /** Center horizontally in a full-width block. Defaults to true. */
  center?: boolean;
  /** Top margin when centered (theme spacing units). Defaults to 3. */
  mt?: number;
  /** Override dot color. Defaults to primary.main. */
  color?: string;
  /** Inline mode for use inside buttons/icons — no bounce, just pulse. */
  inline?: boolean;
}

const LoadingDots: React.FC<LoadingDotsProps> = ({
  size = 8,
  gap,
  center = true,
  mt = 3,
  color,
  inline = false,
}) => {
  const theme = useTheme();
  const dotColor = color ?? (inline ? 'currentColor' : theme.palette.primary.main);
  const dotGap = gap ?? Math.round(size * 0.75);
  const anim = inline ? pulse : wave;

  const dots = (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${dotGap}px`,
        ...(inline ? { lineHeight: 1 } : {}),
      }}
    >
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            width: size,
            height: size,
            borderRadius: '50%',
            bgcolor: dotColor,
            animation: `${anim} 1.4s ease-in-out infinite`,
            animationDelay: `${i * 0.18}s`,
          }}
        />
      ))}
    </Box>
  );

  if (inline || !center) return dots;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', mt }}>
      {dots}
    </Box>
  );
};

export default LoadingDots;
