// Answer grid status bar — reads the grid and delegates render to AnswerGridView.
// A trivia answer or a round asks for it again (features/trivia).
import type React from 'react';
import { useAnswerGrid } from '../model/grids';
import AnswerGridView from './AnswerGridView';

interface TriviaStatusBarProps {
  userId: string;
}

const TriviaStatusBar: React.FC<TriviaStatusBarProps> = ({ userId }) => {
  const grid = useAnswerGrid(userId).data;

  if (!grid) return null;
  return <AnswerGridView grid={grid} userId={userId} />;
};

export default TriviaStatusBar;
