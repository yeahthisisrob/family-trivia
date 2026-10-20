/**
 * Home, once, in a joined circle: whose past answers show here, with the
 * switches right on the card (docs/decisions/0018). Answers from a family
 * circle show unless you turn them off; from any other only if you turn them
 * on. Closed, it stays closed in this circle; the profile keeps the switches.
 */
import { Button, Card, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { inThisCircle } from '../../../shared/session/session';
import type { SharedFrom } from '../api/sharingApi';
import { useSharing } from '../model/useSharing';
import { SharingSwitches } from './SharingSwitches';

const SEEN = 'ft:sharing-card-seen';

const seen = () => {
  try {
    return localStorage.getItem(inThisCircle(SEEN)) === '1';
  } catch {
    return false;
  }
};

export const SharingCardView: React.FC<{
  from: SharedFrom[];
  failed?: boolean;
  onChange: (circleId: string, shared: boolean) => void;
  onDone: () => void;
}> = ({ from, failed, onChange, onDone }) => (
  <Card sx={{ p: 2.5, mb: 2, borderRadius: 3 }}>
    <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
      Your answers here
    </Typography>
    <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
      This circle joins {from.length > 1 ? 'your circles' : 'a circle you’re in'}. Choose which of
      your past answers everyone here can see.
    </Typography>
    <SharingSwitches from={from} failed={failed} onChange={onChange} />
    <Button variant="contained" onClick={onDone} sx={{ mt: 2 }}>
      Done
    </Button>
  </Card>
);

export const SharingCard: React.FC = () => {
  const [closed, setClosed] = useState(seen);
  const { from, failed, set } = useSharing(!closed);
  if (closed || !from?.length) return null;
  return (
    <SharingCardView
      from={from}
      failed={failed}
      onChange={set}
      onDone={() => {
        try {
          localStorage.setItem(inThisCircle(SEEN), '1');
        } catch {
          /* private mode: it shows again next visit */
        }
        setClosed(true);
      }}
    />
  );
};
