// File: src/components/TriviaCard/index.tsx
//
// Trivia tab entry point. Uses TriviaFlowContext to coordinate visibility —
// when a question/game is active, the carousel locks so the active content
// owns the space. Status grids live on the home tab now.

import type React from 'react';
import type { Question } from '../../api/modules/trivia';
import { TriviaFlowProvider } from '../../contexts/TriviaFlowContext';
import TriviaCarousel from './TriviaCarousel';

interface TriviaTabProps {
  userId: string;
  groupId: string;
  onAnswerResult: (
    result: { correct: boolean; streak: number; pointsEarned?: number },
    question?: Question,
    selectedAnswer?: string | null,
  ) => void;
}

const TriviaTab: React.FC<TriviaTabProps> = ({ userId, groupId, onAnswerResult }) => (
  <TriviaFlowProvider>
    <TriviaCarousel userId={userId} groupId={groupId} onAnswerResult={onAnswerResult} />
  </TriviaFlowProvider>
);

export default TriviaTab;
