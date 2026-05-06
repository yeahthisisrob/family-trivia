// File: src/components/TimelineBoard/FactComments.tsx

import React from 'react';

import CommentsThread from '../common/CommentsThread';

interface FactCommentsProps {
  factId: string;
  currentUserId: string;
  getUserColor: (userId: string) => string;
  getUserInitials: (userId: string) => string;
}

const FactComments: React.FC<FactCommentsProps> = ({
  factId,
  currentUserId,
  getUserColor,
  getUserInitials,
}) => {
  return (
    <CommentsThread
      contentId={factId}
      contentType="fact"
      currentUserId={currentUserId}
      getUserColor={getUserColor}
      getUserInitials={getUserInitials}
    />
  );
};

export default FactComments;
