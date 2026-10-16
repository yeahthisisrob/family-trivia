/**
 * Inside the Trivia tab: today's questions, or the trivia leaderboard. In a
 * season without trivia there's nothing to play, so the tabs give way to a
 * line saying so, above the results.
 */
import { Tab, Tabs, Typography } from '@mui/material';
import type React from 'react';
import { ROUTES } from '../../hooks/useApp';

export const TriviaTabs: React.FC<{
  currentPath: string;
  onNavigate: (path: string) => void;
  /** The season runs on the daily questions alone. */
  factsOnly?: boolean;
}> = ({ currentPath, onNavigate, factsOnly }) =>
  factsOnly ? (
    <Typography variant="body2" sx={{ mb: 2, textAlign: 'center', color: 'text.secondary' }}>
      No trivia this season, just the daily questions about us. Here’s how everyone has done.
    </Typography>
  ) : (
    <Tabs
      value={currentPath === ROUTES.LEADERBOARD ? ROUTES.LEADERBOARD : ROUTES.PLAY}
      onChange={(_, v: string) => onNavigate(v)}
      centered
      sx={{ mb: 2 }}
    >
      <Tab value={ROUTES.PLAY} label="Play" />
      <Tab value={ROUTES.LEADERBOARD} label="Leaderboard" />
    </Tabs>
  );
