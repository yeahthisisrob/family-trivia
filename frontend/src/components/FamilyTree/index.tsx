// File: src/components/FamilyTree/index.tsx
import { Box, Fade } from '@mui/material';
import React, { useMemo } from 'react';

import FamilySplitView from './FamilySplitView';
import MemberLoadingError from './MemberLoadingError';
import MemberSpotlight from './MemberSpotlight';
import { FamilyHierarchy } from '../../api';
import { useFamilyData } from '../../contexts/FamilyDataContext';
import { LoadingDots } from '../ui/feedback';

interface FamilyTreeProps {
  userId: string;
  onViewProfile: (userId: string) => void;
}

const FamilyTree: React.FC<FamilyTreeProps> = ({ userId, onViewProfile }) => {
  // Use data already loaded by FamilyDataContext (from /app-init) — no extra API calls
  const {
    hierarchyData: hierarchy,
    groupDescriptions: rawGroupDescriptions,
    loadingMembers: loading,
    loadError: error,
    refreshMembers,
  } = useFamilyData();

  // Map { groupId: { description, lastUpdated } } → { groupId: description }
  const groupDescriptions = useMemo(() => {
    const result: Record<string, string> = {};
    for (const [groupId, desc] of Object.entries(rawGroupDescriptions)) {
      result[groupId] = typeof desc === 'string' ? desc : desc.description || '';
    }
    return result;
  }, [rawGroupDescriptions]);

  if (loading) {
    return (
      <LoadingDots mt={0} />
    );
  }

  if (
    error ||
    !hierarchy ||
    !hierarchy.family ||
    !hierarchy.family.groups ||
    !hierarchy.family.people
  ) {
    return (
      <MemberLoadingError
        message={
          error ||
          'Failed to load family data. Please try again later.'
        }
        onRetry={() => refreshMembers(true)}
      />
    );
  }

  return (
    <Fade in={true}>
      <Box>
        <MemberSpotlight
          hierarchy={hierarchy}
          currentUserId={userId}
          onMemberClick={onViewProfile}
          key={`member-spotlight-${userId}`}
        />

        <FamilySplitView
          hierarchy={hierarchy}
          groupDescriptions={groupDescriptions}
          currentUserId={userId}
          onMemberClick={onViewProfile}
        />
      </Box>
    </Fade>
  );
};

export default FamilyTree;
