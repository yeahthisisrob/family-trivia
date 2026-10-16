/** The family graph as a section of the Family tab: loads its own data. */
import { Box, Typography } from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { type GraphData, graphApi } from '../api/graphApi';
import { FamilyGraph } from './FamilyGraph';

export const FamilyGraphSection: React.FC<{
  meId: string;
  onOpenProfile?: (id: string) => void;
}> = ({ meId, onOpenProfile }) => {
  const [data, setData] = useState<GraphData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    graphApi
      .get()
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed || (data && data.people.length < 2)) return null;
  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        sx={{
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          mb: 1,
          color: 'text.secondary',
        }}
      >
        How we're connected
      </Typography>
      {data ? (
        <FamilyGraph data={data} meId={meId} height={520} onOpenProfile={onOpenProfile} />
      ) : (
        <Box sx={{ height: 520, borderRadius: 2, bgcolor: 'night.sky' }} />
      )}
      <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
        Lines show family ties and people who answered the daily questions alike. Tap someone to see
        what you share.
      </Typography>
    </Box>
  );
};
