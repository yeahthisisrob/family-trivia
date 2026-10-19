import { Stack } from '@mui/material';
import type React from 'react';
import { useFamilyData } from '../../contexts/FamilyDataContext';
import { CirclesAdmin } from '../../features/circles';
import { InvitesAdmin } from '../../features/invites';
import { currentCircleId, loadCircles, loadSession } from '../../session';

/** Admin › Circles: invite people to this circle; the owner also starts circles. */
const CirclesTab: React.FC = () => {
  const { members } = useFamilyData();
  const me = loadSession() ?? '';
  const circles = loadCircles();
  const here = circles?.circles.find((c) => c.id === circles.current);
  const people = members.map((m) => ({ id: m.userId, name: m.name, joined: m.activated }));
  return (
    <Stack spacing={2}>
      <InvitesAdmin circleName={here?.name ?? 'your circle'} people={people} />
      <CirclesAdmin
        currentId={currentCircleId() ?? ''}
        yourName={members.find((m) => m.userId === me)?.name ?? ''}
      />
    </Stack>
  );
};

export { CirclesTab };
