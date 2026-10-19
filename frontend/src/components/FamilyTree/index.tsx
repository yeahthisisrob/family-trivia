// File: src/components/FamilyTree/index.tsx
/**
 * Us. The page itself is the family-home feature; this puts the
 * tree, the connections graph and (when the family turned them on) the
 * albums behind its doors, and the archive at the foot.
 */

import { capitalized } from '@family-trivia/shared';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import DownloadIcon from '@mui/icons-material/Download';
import HubIcon from '@mui/icons-material/Hub';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import { Box, Button, Fade } from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useFamilyData } from '../../contexts/FamilyDataContext';
import { useCircleWords } from '../../entities/circle';
import { useFeatures } from '../../entities/settings';
import { ArchiveDialog } from '../../features/family-archive';
import { Connections } from '../../features/family-graph';
import { type FamilyDoor, FamilyHome } from '../../features/family-home';
import { SeasonLookBack } from '../../features/look-back';
import FamilySplitView from './FamilySplitView';

const PhotosPage = React.lazy(() => import('../Photos'));

interface FamilyTreeProps {
  userId: string;
  isAdmin?: boolean;
  onViewProfile: (userId: string) => void;
}

const FamilyTree: React.FC<FamilyTreeProps> = ({ userId, isAdmin, onViewProfile }) => {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const features = useFeatures();
  const { words } = useCircleWords();
  const { hierarchyData: hierarchy, groupDescriptions: raw } = useFamilyData();

  const groupDescriptions = useMemo(() => {
    const result: Record<string, string> = {};
    for (const [groupId, desc] of Object.entries(raw)) {
      result[groupId] = typeof desc === 'string' ? desc : desc.description || '';
    }
    return result;
  }, [raw]);

  const doors: FamilyDoor[] = [];
  if (hierarchy?.family?.groups) {
    doors.push({
      id: 'tree',
      title: words.tree,
      caption: words.treeHint,
      icon: <AccountTreeIcon />,
      render: (_graph, openPerson) => (
        <FamilySplitView
          hierarchy={hierarchy}
          groupDescriptions={groupDescriptions}
          currentUserId={userId}
          onMemberClick={openPerson}
        />
      ),
    });
  }
  doors.push({
    id: 'connections',
    title: 'How we’re connected',
    caption: 'What we talk about, and who is whose',
    icon: <HubIcon />,
    render: (graph, openPerson) => (
      <Connections data={graph} meId={userId} height={640} onOpenProfile={openPerson} />
    ),
  });
  doors.push({
    id: 'look-back',
    title: 'Look back',
    caption: 'Every season, in our own words',
    icon: <AutoStoriesIcon />,
    render: (_graph, openPerson) => <SeasonLookBack onOpenPerson={openPerson} />,
  });
  if (features.photos) {
    doors.push({
      id: 'albums',
      title: 'Albums',
      caption: `${capitalized(words.whose).replace("'", '’')} shared photos`,
      icon: <PhotoLibraryIcon />,
      render: () => (
        <React.Suspense fallback={null}>
          <PhotosPage userId={userId} isAdmin={isAdmin} />
        </React.Suspense>
      ),
    });
  }

  return (
    <Fade in>
      <Box>
        <FamilyHome
          meId={userId}
          doors={doors}
          onOpenPerson={onViewProfile}
          footer={
            <Box sx={{ textAlign: 'center' }}>
              <Button startIcon={<DownloadIcon />} onClick={() => setArchiveOpen(true)}>
                Download {words.archive}
              </Button>
            </Box>
          }
        />
        {archiveOpen && <ArchiveDialog onClose={() => setArchiveOpen(false)} />}
      </Box>
    </Fade>
  );
};

export default FamilyTree;
