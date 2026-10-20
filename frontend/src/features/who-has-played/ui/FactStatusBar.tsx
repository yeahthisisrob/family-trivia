// Daily fact answer grid. Same UX as TriviaStatusBar but for facts.
// Blue = answered, grey = skipped, purple pulse = catch-up gap.

import { alpha, Box, Divider, keyframes, Typography, useTheme } from '@mui/material';
import React, { useEffect, useRef } from 'react';
import { colors } from '../../../shared/design-system';
import { useFactGrid } from '../model/grids';

const ANSWERED = colors.accent.blue;
const CATCHUP = colors.accent.purple;

const catchupPulse = (gap: string) => keyframes`
  0%, 100% { transform: scale(1); background-color: ${gap}; box-shadow: none; }
  50% { transform: scale(1.15); background-color: ${alpha(CATCHUP, 0.45)}; box-shadow: 0 0 6px 2px ${alpha(CATCHUP, 0.25)}; }
`;

interface FactStatusBarProps {
  userId: string;
}

const CELL = 13;
const GAP = 3;
const NAME_W = 56;

const FactStatusBar: React.FC<FactStatusBarProps> = ({ userId }) => {
  const theme = useTheme();
  const gapColor = alpha(theme.palette.grey[500], 0.25);
  const gapPulse = catchupPulse(gapColor);
  const scrollRef = useRef<HTMLDivElement>(null);

  const grid = useFactGrid(userId).data;

  // Scroll to right on load AND when tab becomes visible
  useEffect(() => {
    if (!grid || !scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollLeft = el.scrollWidth;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.scrollLeft = el.scrollWidth;
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [grid]);

  if (!grid?.rows?.length) return null;

  const seasonCols = new Set(grid.seasonMarkers.map((m) => m.column));
  const sStart = grid.seasonStartCol;

  return (
    <Box sx={{ mb: 1.5 }}>
      <Box
        ref={scrollRef}
        sx={{
          overflowX: 'auto',
          width: '100%',
          '&::-webkit-scrollbar': { height: 3 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: alpha(theme.palette.divider, 0.2),
            borderRadius: 2,
          },
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            flexDirection: 'column',
            minWidth: 'max-content',
            pt: '26px',
            position: 'relative',
          }}
        >
          {/* Season labels */}
          {grid.seasonMarkers.map((m) => {
            const sepsBeforeThis = grid.seasonMarkers.filter(
              (sm) => sm.column > 0 && sm.column <= m.column,
            ).length;
            const x = NAME_W + m.column * (CELL + GAP) + sepsBeforeThis * 9;
            return (
              <Typography
                key={m.column}
                sx={{
                  position: 'absolute',
                  left: x,
                  top: 0,
                  fontSize: '0.48rem',
                  fontWeight: 700,
                  color: alpha(theme.palette.text.secondary, 0.45),
                  whiteSpace: 'nowrap',
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  pointerEvents: 'none',
                }}
              >
                {m.label}
              </Typography>
            );
          })}

          {/* Question numbers for current season — 1, 2, 3... over each cell */}
          {Array.from({ length: grid.totalColumns }).map((_, ci) => {
            if (ci < sStart) return null;
            const n = ci - sStart + 1;
            const sepsBefore = grid.seasonMarkers.filter(
              (m) => m.column > 0 && m.column <= ci,
            ).length;
            const x = NAME_W + ci * (CELL + GAP) + sepsBefore * 9 + CELL / 2;
            const isToday = ci === grid.todayColumn;
            return (
              <Typography
                key={`num-${ci}`}
                sx={{
                  position: 'absolute',
                  left: x,
                  top: 12,
                  transform: 'translateX(-50%)',
                  fontSize: '0.5rem',
                  fontWeight: isToday ? 800 : 600,
                  color: isToday
                    ? theme.palette.primary.main
                    : alpha(theme.palette.text.secondary, 0.5),
                  letterSpacing: 0,
                  pointerEvents: 'none',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {n}
              </Typography>
            );
          })}

          {grid.rows.map((row, ri) => {
            const isMe = row.userId === userId;
            const hasGaps = row.seasonGaps > 0;

            return (
              <React.Fragment key={row.userId}>
                {ri === 1 && (
                  <Divider sx={{ my: '2px', borderColor: alpha(theme.palette.divider, 0.15) }} />
                )}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    height: CELL,
                    mb: `${GAP}px`,
                    ...(isMe && {
                      bgcolor: alpha(theme.palette.primary.main, 0.02),
                      borderRadius: '3px',
                    }),
                  }}
                >
                  {/* Name — sticky */}
                  <Box
                    sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      width: NAME_W,
                      minWidth: NAME_W,
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      pr: 0.75,
                      bgcolor: theme.palette.background.default,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.65rem',
                        lineHeight: 1,
                        fontWeight: isMe ? 700 : 400,
                        color: isMe ? theme.palette.text.primary : theme.palette.text.secondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.userId}
                    </Typography>
                  </Box>

                  {/* Cells */}
                  {row.cells.map((c, ci) => {
                    const isSeason = seasonCols.has(ci) && ci > 0;
                    const isActiveGap = hasGaps && c.result === null && ci >= sStart;

                    return (
                      <React.Fragment key={ci}>
                        {isSeason && (
                          <Box
                            sx={{
                              width: '1px',
                              flexShrink: 0,
                              mx: '4px',
                              alignSelf: 'stretch',
                              bgcolor: alpha(theme.palette.primary.main, 0.2),
                            }}
                          />
                        )}
                        <Box
                          sx={{
                            width: CELL,
                            height: CELL,
                            flexShrink: 0,
                            borderRadius: '3px',
                            ml: isSeason ? 0 : `${GAP}px`,
                            // Blue = answered, grey = skipped, purple pulse = catch-up
                            bgcolor:
                              c.result === true
                                ? ANSWERED
                                : c.result === false
                                  ? alpha(theme.palette.text.disabled, 0.25)
                                  : isActiveGap
                                    ? isMe
                                      ? gapColor
                                      : alpha(theme.palette.grey[500], 0.15)
                                    : 'transparent',
                            ...(isMe &&
                              isActiveGap && {
                                animation: `${gapPulse} 1.8s ease-in-out infinite`,
                                animationDelay: `${(ci % 4) * 0.15}s`,
                              }),
                          }}
                        />
                      </React.Fragment>
                    );
                  })}
                </Box>
              </React.Fragment>
            );
          })}
        </Box>
      </Box>
      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 1.5, mt: 0.75, ml: `${NAME_W}px`, flexWrap: 'wrap' }}>
        {[
          { color: ANSWERED, label: 'Answered' },
          { color: alpha(theme.palette.text.disabled, 0.25), label: 'Skipped' },
          { color: gapColor, label: 'Waiting' },
        ].map((item) => (
          <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: item.color }} />
            <Typography
              sx={{ fontSize: '0.5rem', color: alpha(theme.palette.text.secondary, 0.6) }}
            >
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default FactStatusBar;
