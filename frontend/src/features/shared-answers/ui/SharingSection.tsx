import { Skeleton } from '@mui/material';
import type React from 'react';
import { useSharing } from '../model/useSharing';
import { SharingSwitches } from './SharingSwitches';

/** On your own profile in a joined circle: the same switches as the Home card. */
export const SharingChoices: React.FC = () => {
  const { from, failed, set } = useSharing();
  if (!from) return failed ? null : <Skeleton variant="rounded" height={72} />;
  return <SharingSwitches from={from} failed={failed} onChange={set} />;
};
