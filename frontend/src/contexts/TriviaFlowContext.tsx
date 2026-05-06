// File: src/contexts/TriviaFlowContext.tsx
//
// Lightweight context that publishes the trivia flow state so siblings
// (status bar, carousel chrome) can react without prop drilling.
//
// TriviaFlow writes to this context via useTriviaFlowPublisher().
// Consumers read via useTriviaFlow().

import React, { createContext, useContext, useMemo, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────

export type FlowState = 'idle' | 'difficulty' | 'generating' | 'answering' | 'result' | 'done';

interface TriviaFlowContextValue {
  /** Current state of the trivia flow state machine */
  flowState: FlowState;
  /** Active game mode id, or null if not in a game */
  activeGameMode: string | null;
  /** True when a question or game is in progress (not idle/done) */
  isActive: boolean;
}

interface TriviaFlowDispatch {
  setFlowState: (state: FlowState) => void;
  setActiveGameMode: (mode: string | null) => void;
}

const FlowContext = createContext<TriviaFlowContextValue>({
  flowState: 'idle',
  activeGameMode: null,
  isActive: false,
});

const DispatchContext = createContext<TriviaFlowDispatch>({
  setFlowState: () => {},
  setActiveGameMode: () => {},
});

// ── Provider ─────────────────────────────────────────────────────────

export const TriviaFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [activeGameMode, setActiveGameMode] = useState<string | null>(null);

  const isActive = flowState !== 'idle' && flowState !== 'done' || activeGameMode !== null;

  const value = useMemo<TriviaFlowContextValue>(
    () => ({ flowState, activeGameMode, isActive }),
    [flowState, activeGameMode, isActive],
  );

  const dispatch = useMemo<TriviaFlowDispatch>(
    () => ({ setFlowState, setActiveGameMode }),
    [],
  );

  return (
    <FlowContext.Provider value={value}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </FlowContext.Provider>
  );
};

// ── Hooks ────────────────────────────────────────────────────────────

/** Read the flow state. Used by status bar, carousel, etc. */
export const useTriviaFlow = (): TriviaFlowContextValue => useContext(FlowContext);

/** Write to the flow state. Used only by TriviaFlow. Split from the
 *  read context so consumers don't re-render when only the writer updates. */
export const useTriviaFlowDispatch = (): TriviaFlowDispatch => useContext(DispatchContext);
