// File: src/components/FamilyTree/index.tsx
import DownloadIcon from '@mui/icons-material/Download';
import { Box, Button, Fade } from '@mui/material';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useFamilyData } from '../../contexts/FamilyDataContext';
import { ArchiveDialog } from '../../features/family-archive';
import { FamilyGraphSection } from '../../features/family-graph';
import { LoadingDots } from '../ui/feedback';
import FamilySplitView from './FamilySplitView';
import MemberLoadingError from './MemberLoadingError';
import MemberSpotlight from './MemberSpotlight';

interface FamilyTreeProps {
  userId: string;
  onViewProfile: (userId: string) => void;
}

const FamilyTree: React.FC<FamilyTreeProps> = ({ userId, onViewProfile }) => {
  const [archiveOpen, setArchiveOpen] = useState(false);
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
    return <LoadingDots mt={0} />;
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
        message={error || 'Failed to load family data. Please try again later.'}
        onRetry={() => refreshMembers(true)}
      />
    );
  }

  return (
    <Fade in={true}>
      <Box>
        <FamilyGraphSection meId={userId} onOpenProfile={onViewProfile} />

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

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Button startIcon={<DownloadIcon />} onClick={() => setArchiveOpen(true)}>
            Download the family archive
          </Button>
        </Box>
        {archiveOpen && <ArchiveDialog onClose={() => setArchiveOpen(false)} />}
      </Box>
    </Fade>
  );
};

export default FamilyTree;
