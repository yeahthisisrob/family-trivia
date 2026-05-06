// File: src/components/TimelineBoard/TriviaComments.tsx

import React from 'react';

import CommentsThread from '../common/CommentsThread';

interface TriviaCommentsProps {
  triviaId: string;
  currentUserId: string;
  getUserColor: (userId: string) => string;
  getUserInitials: (userId: string) => string;
}

const TriviaComments: React.FC<TriviaCommentsProps> = ({
  triviaId,
  currentUserId,
  getUserColor,
  getUserInitials,
}) => {
  return (
    <CommentsThread
      contentId={triviaId}
      contentType="trivia"
      currentUserId={currentUserId}
      getUserColor={getUserColor}
      getUserInitials={getUserInitials}
      textOverrides={{
        placeholderText: 'Comment on this...',
      }}
    />
  );
};

export default TriviaComments;
