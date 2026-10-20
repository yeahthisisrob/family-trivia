// Answer grid status bar — reads the grid and delegates render to AnswerGridView.
// Asks again when refreshTimestamp bumps (after any trivia/game-mode answer).
import type React from 'react';
import { useTrivia } from '../../../contexts/TriviaContext';
import { useAnswerGrid } from '../model/grids';
import AnswerGridView from './AnswerGridView';

interface TriviaStatusBarProps {
  userId: string;
}

const TriviaStatusBar: React.FC<TriviaStatusBarProps> = ({ userId }) => {
  const { refreshTimestamp } = useTrivia();
  const grid = useAnswerGrid(userId, refreshTimestamp).data;

  if (!grid) return null;
  return <AnswerGridView grid={grid} userId={userId} />;
};

export default TriviaStatusBar;
