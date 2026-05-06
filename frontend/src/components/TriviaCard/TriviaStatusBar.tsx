// Answer grid status bar — fetches grid data and delegates render to AnswerGridView.
// Refetches when refreshTimestamp bumps (after any trivia/game-mode answer).
import React, { useEffect, useState } from 'react';

import AnswerGridView, { AnswerGridData } from './AnswerGridView';
import { useTrivia } from '../../contexts/TriviaContext';
import { apiService } from '../../services/ApiService';

interface TriviaStatusBarProps { userId: string }

const TriviaStatusBar: React.FC<TriviaStatusBarProps> = ({ userId }) => {
  const { refreshTimestamp } = useTrivia();
  const [grid, setGrid] = useState<AnswerGridData | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Bypass cache on refetches so newly-answered questions show immediately
    apiService.request<AnswerGridData>(
      `/answer-grid?userId=${encodeURIComponent(userId)}&_=${refreshTimestamp}`,
      { method: 'GET' },
    ).then(data => { if (!cancelled) setGrid(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId, refreshTimestamp]);

  if (!grid) return null;
  return <AnswerGridView grid={grid} userId={userId} />;
};

export default TriviaStatusBar;
