/** Inside the Trivia tab: today's questions, or the trivia leaderboard. */
import { Tab, Tabs } from '@mui/material';
import type React from 'react';
import { ROUTES } from '../../hooks/useApp';

export const TriviaTabs: React.FC<{ currentPath: string; onNavigate: (path: string) => void }> = ({
  currentPath,
  onNavigate,
}) => (
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
