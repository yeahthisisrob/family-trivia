/**
 * How we're connected, two ways: Our map (what we talk about, as
 * territories) and Family ties (who is whose, and who answers alike).
 */
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { useCircleWords } from '../../../entities/circle';
import type { GraphData } from '../../../entities/family';
import { FamilyGraph } from './FamilyGraph';
import { FamilyMap } from './FamilyMap';

type View = 'map' | 'ties';

export const Connections: React.FC<{
  data: GraphData;
  meId?: string | null;
  height?: number;
  onOpenProfile?: (personId: string) => void;
}> = ({ data, meId, height = 640, onOpenProfile }) => {
  const { words } = useCircleWords();
  const [view, setView] = useState<View>('map');
  return (
    <>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={view}
        onChange={(_, v: View | null) => v && setView(v)}
        sx={{ mb: 1.5 }}
        aria-label={`How to look at ${words.circle}`}
      >
        <ToggleButton value="map">Our map</ToggleButton>
        <ToggleButton value="ties">{words.ties}</ToggleButton>
      </ToggleButtonGroup>
      {view === 'map' ? (
        <FamilyMap data={data} meId={meId} height={height} onOpenProfile={onOpenProfile} />
      ) : (
        <FamilyGraph data={data} meId={meId} height={height} onOpenProfile={onOpenProfile} />
      )}
    </>
  );
};
