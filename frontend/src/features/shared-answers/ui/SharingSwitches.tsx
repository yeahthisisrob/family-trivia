import { Alert, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import type React from 'react';
import type { SharedFrom } from '../api/sharingApi';

/** One switch per circle someone's past answers could show from. */
export const SharingSwitches: React.FC<{
  from: SharedFrom[];
  failed?: boolean;
  onChange: (circleId: string, shared: boolean) => void;
}> = ({ from, failed, onChange }) => (
  <Stack spacing={0.5}>
    {from.map((f) => (
      <FormControlLabel
        key={f.circleId}
        control={
          <Switch checked={f.shared} onChange={(e) => onChange(f.circleId, e.target.checked)} />
        }
        label={
          <Typography>
            Your answers from <b>{f.name}</b>
          </Typography>
        }
      />
    ))}
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      Nothing is copied: they stay where you gave them. Turn one off and it stops showing here.
    </Typography>
    {failed && <Alert severity="warning">That didn't save. Try again in a moment.</Alert>}
  </Stack>
);
