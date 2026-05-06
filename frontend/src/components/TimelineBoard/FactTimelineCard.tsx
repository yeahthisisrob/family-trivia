// Individual card component for fact timeline
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { Avatar, Box, Card, Chip, Collapse, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState } from 'react';

import { colors } from '../../shared/design-system/tokens/colors';

// Custom category purple — use the design system token
const CUSTOM_CATEGORY = colors.category.custom;
const CUSTOM_CATEGORY_DARK = '#7B1FA2';

interface FactEntry {
  userId: string;
  color: string;
  initials: string;
  question: string;
  answer: string;
  fact?: string;
  timestamp: string;
  group: string;
  skipped?: boolean;
  isCustomFact?: boolean;
}

interface FactTimelineCardProps {
  entry: FactEntry;
  onUserClick?: (userId: string) => void;
  children?: React.ReactNode;
  wrapWithCard?: boolean;
}

const FactTimelineCard: React.FC<FactTimelineCardProps> = ({
  entry,
  onUserClick,
  children,
  wrapWithCard = true,
}) => {
  const theme = useTheme();
  const [expandedSkippedFact, setExpandedSkippedFact] = useState<boolean>(false);
  const [expandedFunFact, setExpandedFunFact] = useState<boolean>(false);

  const cardContent = (
    <>
      <Box sx={{ p: 2, pb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            mb: 1.5,
          }}
        >
          <Avatar
            sx={{
              bgcolor: entry.color,
              width: 36,
              height: 36,
              fontSize: '0.8rem',
              cursor: onUserClick ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              boxShadow: `0 2px 8px ${alpha(entry.color, 0.3)}`,
              '&:hover': onUserClick
                ? {
                    transform: 'scale(1.05)',
                    boxShadow: `0 4px 12px ${alpha(entry.color, 0.4)}`,
                  }
                : {},
            }}
            onClick={() => onUserClick && onUserClick(entry.userId)}
          >
            {entry.initials}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 0.75,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: onUserClick ? 'pointer' : 'default',
                  lineHeight: 1.2,
                  transition: 'all 0.2s ease',
                  color: theme.palette.text.primary,
                  '&:hover': onUserClick
                    ? {
                        color: theme.palette.primary.main,
                      }
                    : {},
                }}
                onClick={() => onUserClick && onUserClick(entry.userId)}
              >
                {entry.userId}
              </Typography>

              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.7rem',
                  color: theme.palette.text.secondary,
                  fontWeight: 500,
                }}
              >
                {new Date(entry.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                flexWrap: 'wrap',
              }}
            >
              <Chip
                label={entry.group}
                size="small"
                sx={{
                  bgcolor: alpha(entry.color, 0.1),
                  color: entry.color,
                  fontSize: '0.7rem',
                  height: 20,
                  px: 0.5,
                  fontWeight: 600,
                  borderRadius: 1.5,
                  maxWidth: '160px',
                  '& .MuiChip-label': {
                    px: 0.75,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
              />

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  flexWrap: 'wrap',
                }}
              >
                <Box
                  sx={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.text.secondary, 0.4),
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.7rem',
                    color: theme.palette.text.secondary,
                    fontWeight: 600,
                  }}
                >
                  Daily Fact
                </Typography>

                {entry.isCustomFact && (
                  <>
                    <Box
                      sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: alpha(theme.palette.text.secondary, 0.4),
                      }}
                    />
                    <Chip
                      label="Custom"
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.palette.secondary.main, 0.1),
                        color: theme.palette.secondary.main,
                        fontSize: '0.65rem',
                        height: 20,
                        fontWeight: 700,
                        borderRadius: 1.5,
                        border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
                        '& .MuiChip-label': {
                          px: 0.5,
                        },
                      }}
                    />
                  </>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: 2, pb: 1.5 }}>
        {entry.skipped ? (
          // Skipped fact display
          <Box>
            <Box
              onClick={() => setExpandedSkippedFact(!expandedSkippedFact)}
              sx={{
                borderRadius: 2,
                background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.08)} 0%, ${alpha(theme.palette.warning.main, 0.04)} 100%)`,
                border: `1px solid ${alpha(theme.palette.warning.main, 0.15)}`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                overflow: 'hidden',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: `0 4px 12px ${alpha(theme.palette.warning.main, 0.2)}`,
                },
              }}
            >
              <Box
                sx={{
                  px: 1.5,
                  py: 0.75,
                  bgcolor: alpha(theme.palette.warning.main, 0.08),
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: theme.palette.warning.dark,
                  }}
                >
                  {expandedSkippedFact
                    ? 'Click to hide skipped question'
                    : 'Skipped daily fact (click to see question)'}
                </Typography>
              </Box>
            </Box>
            <Collapse in={expandedSkippedFact}>
              <Box
                sx={{
                  mt: 1,
                  borderRadius: 2,
                  overflow: 'hidden',
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                }}
              >
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.75,
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: theme.palette.primary.main,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Skipped Question
                  </Typography>
                </Box>
                <Box sx={{ p: 1.5, pt: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.8rem',
                      lineHeight: 1.6,
                      color: theme.palette.text.secondary,
                      fontStyle: 'italic',
                    }}
                  >
                    {entry.question}
                  </Typography>
                </Box>
              </Box>
            </Collapse>
            {children}
          </Box>
        ) : (
          // Regular fact display
          <Box>
            <Box
              onClick={() => {
                if (entry.fact) {
                  setExpandedFunFact(!expandedFunFact);
                }
              }}
              sx={{
                cursor: entry.fact ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
              }}
            >
              <Box
                sx={{
                  mb: 2,
                  borderLeft: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  pl: 1.5,
                  py: 0.5,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: 500,
                    color: alpha(theme.palette.text.secondary, 0.8),
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    mb: 0.5,
                    display: 'block',
                  }}
                >
                  Question
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '0.8rem',
                    lineHeight: 1.5,
                    color: alpha(theme.palette.text.primary, 0.85),
                    fontWeight: 400,
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                >
                  {entry.question}
                </Typography>
              </Box>
              {entry.answer && (
                <Box
                  sx={{
                    mb: 1.5,
                    position: 'relative',
                    background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.12)} 0%, ${alpha(theme.palette.success.main, 0.08)} 100%)`,
                    border: `2px solid ${alpha(theme.palette.success.main, 0.25)}`,
                    borderRadius: 4,
                    overflow: 'hidden',
                    boxShadow: `0 4px 16px ${alpha(theme.palette.success.main, 0.15)}, 0 2px 8px ${alpha(theme.palette.success.main, 0.1)}`,
                    transform: 'translateY(-1px)',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: 6,
                      background: `linear-gradient(180deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                      boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.success.light, 0.3)}`,
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1.25,
                      p: 2,
                      pl: 3,
                    }}
                  >
                    <FormatQuoteIcon
                      sx={{
                        fontSize: '1.3rem',
                        color: theme.palette.success.main,
                        mt: 0.25,
                        transform: 'rotate(180deg)',
                        flexShrink: 0,
                        filter: `drop-shadow(0 1px 2px ${alpha(theme.palette.success.main, 0.3)})`,
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.9rem',
                        lineHeight: 1.6,
                        color: theme.palette.text.primary,
                        fontStyle: 'italic',
                        fontWeight: 500,
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        flex: 1,
                        textShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.05)}`,
                      }}
                    >
                      {entry.answer}
                    </Typography>
                    <FormatQuoteIcon
                      sx={{
                        fontSize: '1.3rem',
                        color: theme.palette.success.main,
                        alignSelf: 'flex-end',
                        flexShrink: 0,
                        filter: `drop-shadow(0 1px 2px ${alpha(theme.palette.success.main, 0.3)})`,
                      }}
                    />
                  </Box>
                </Box>
              )}

              {entry.fact && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    mt: 1,
                  }}
                >
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      px: 1,
                      py: 0.5,
                      background: alpha(CUSTOM_CATEGORY, 0.1),
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      border: `1px solid ${alpha(CUSTOM_CATEGORY, 0.2)}`,
                      '&:hover': {
                        bgcolor: alpha(CUSTOM_CATEGORY, 0.15),
                        borderColor: alpha(CUSTOM_CATEGORY, 0.3),
                      },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedFunFact(!expandedFunFact);
                    }}
                  >
                    <LightbulbIcon
                      sx={{
                        fontSize: '0.9rem',
                        mr: 0.5,
                        color: CUSTOM_CATEGORY,
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.7rem',
                        color: CUSTOM_CATEGORY,
                        fontWeight: 600,
                        textTransform: 'none',
                      }}
                    >
                      {expandedFunFact ? 'Hide Fun Fact' : 'Show AI Fun Fact'}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>

            {entry.fact && (
              <Collapse in={expandedFunFact}>
                <Box
                  sx={{
                    mt: 1.5,
                    borderRadius: 2,
                    overflow: 'hidden',
                    background: `linear-gradient(135deg, ${alpha(CUSTOM_CATEGORY, 0.08)} 0%, ${alpha(CUSTOM_CATEGORY_DARK, 0.04)} 100%)`,
                    border: `1px solid ${alpha(CUSTOM_CATEGORY, 0.15)}`,
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                      background: `linear-gradient(90deg, ${CUSTOM_CATEGORY} 0%, ${CUSTOM_CATEGORY_DARK} 100%)`,
                    },
                  }}
                >
                  <Box
                    sx={{
                      px: 1.5,
                      py: 0.75,
                      bgcolor: alpha(CUSTOM_CATEGORY, 0.08),
                      borderBottom: `1px solid ${alpha(CUSTOM_CATEGORY, 0.15)}`,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: CUSTOM_CATEGORY,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      AI Generated Insight
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5, pt: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.8rem',
                        color: theme.palette.text.primary,
                        lineHeight: 1.7,
                        fontStyle: 'italic',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                      }}
                    >
                      {entry.fact}
                    </Typography>
                  </Box>
                </Box>
              </Collapse>
            )}
            {children}
          </Box>
        )}
      </Box>
    </>
  );

  if (wrapWithCard) {
    return (
      <Card
        elevation={0}
        sx={{
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          bgcolor: 'background.paper',
          transition: 'box-shadow 0.3s ease',
          '&:hover': {
            boxShadow: theme.shadows[2],
          },
        }}
      >
        {cardContent}
      </Card>
    );
  }

  return cardContent;
};

export default FactTimelineCard;
