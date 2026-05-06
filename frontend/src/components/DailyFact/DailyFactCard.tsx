/**
 * DailyFactCard — sleek presentational shell for the daily fact flow.
 *
 * State machine lives in `useDailyFactFlow`. This file is rendering only.
 * Two modes:
 *   - inline: compact card on the home page
 *   - modal:  full-width content inside a Dialog
 */

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardVoiceOutlinedIcon from '@mui/icons-material/KeyboardVoiceOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import {
  Box,
  Card,
  Typography,
  TextField,
  Chip,
  Button,
  IconButton,
  LinearProgress,
  Fade,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState } from 'react';

import FactAnswerInput from './FactAnswerInput';
import { useDailyFactFlow } from './useDailyFactFlow';
import { colors } from '../../shared/design-system/tokens/colors';
import { radii } from '../../shared/design-system/tokens/radii';
import { LoadingDots } from '../ui/feedback';

import type { QuestionOption } from '../../api/modules/facts';

// ── Constants ────────────────────────────────────────────────────

const FIRST_PERSON_CATEGORIES = [
  { label: 'Small Wins', emoji: '\u{2B50}' },
  { label: 'Life Chapters', emoji: '\u{1F4D6}' },
  { label: 'What Matters', emoji: '\u{1F3AF}' },
  { label: 'Playful You', emoji: '\u{1F604}' },
  { label: 'Looking Forward', emoji: '\u{1F308}' },
  { label: 'Shared Memories', emoji: '\u{1F4AB}' },
  { label: 'Surprise Me', emoji: '\u{1F3B2}' },
] as const;

const CATEGORY_LABELS: string[] = FIRST_PERSON_CATEGORIES.map(c => c.label);

function daysAgoText(date: string): string {
  const d = new Date(date + 'T12:00:00');
  const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Public types ─────────────────────────────────────────────────

export interface DailyFactCardProps {
  userId: string;
  /** inline = compact home card, modal = full-width inside a Dialog */
  mode?: 'inline' | 'modal';
  onFactSubmitted?: () => void;
  onDone?: () => void;
  /**
   * "Just close this for now." Hits no API, marks no skip — purely a UI
   * dismiss. Same intent as the modal X or backdrop click. The parent
   * decides whether to persist that dismissal (e.g. sessionStorage).
   */
  onDismiss?: () => void;
}

// ── Component ────────────────────────────────────────────────────

const DailyFactCard: React.FC<DailyFactCardProps> = ({
  userId, mode = 'inline', onFactSubmitted, onDone, onDismiss,
}) => {
  const isModal = mode === 'modal';
  const [state, actions] = useDailyFactFlow({ userId, onFactSubmitted, onDone });
  const [answer, setAnswer] = useState('');
  const [skipConfirm, setSkipConfirm] = useState(false);

  if (state.step === 'done') return null;

  const handleSubmit = async () => {
    const ok = await actions.submit(answer);
    if (ok) {
      setAnswer('');
      setSkipConfirm(false);
    }
  };

  const handleSkip = async () => {
    const ok = await actions.skip();
    if (ok) {
      setAnswer('');
      setSkipConfirm(false);
    }
  };

  const isFirstPersonStep =
    state.step === 'firstPerson' ||
    state.step === 'firstPersonGen' ||
    state.step === 'firstPersonPick' ||
    state.step === 'firstPersonDone';

  const isQuestionStep =
    state.step === 'question' ||
    state.step === 'submitting' ||
    state.step === 'response';

  // ── Header ─────────────────────────────────────────────────────

  const headerTitle = isFirstPersonStep
    ? "You're Today's Creator!"
    : state.isCatchup ? 'Catch Up' : "Today's Question";

  const headerIcon = isFirstPersonStep
    ? <AutoAwesomeIcon sx={{ fontSize: isModal ? 22 : 18, color: colors.brand.secondary }} />
    : <LightbulbOutlinedIcon sx={{ fontSize: isModal ? 22 : 18, color: colors.brand.primary }} />;

  const chipLabel = state.isCatchup
    ? `${state.totalCatchup - state.catchupRemaining} of ${state.totalCatchup}`
    : `${state.totalCatchup} to catch up`;

  const header = (
    <Box sx={{
      px: isModal ? 2.5 : 2,
      py: isModal ? 1.5 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: `linear-gradient(135deg, ${alpha(colors.brand.primary, 0.10)}, ${alpha(colors.brand.primaryDark, 0.05)})`,
      borderBottom: `1px solid ${colors.border.light}`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {headerIcon}
        <Typography sx={{
          fontWeight: 700,
          fontSize: isModal ? '1rem' : '0.85rem',
          color: colors.text.primary,
          letterSpacing: 0.2,
        }}>
          {headerTitle}
        </Typography>
      </Box>
      {state.totalCatchup > 0 && isQuestionStep && (
        <Chip
          size="small"
          label={chipLabel}
          sx={{
            height: 22,
            fontSize: isModal ? '0.7rem' : '0.62rem',
            fontWeight: 700,
            bgcolor: alpha(colors.brand.secondary, 0.12),
            color: colors.brand.secondaryDark,
            border: `1px solid ${alpha(colors.brand.secondary, 0.25)}`,
          }}
        />
      )}
    </Box>
  );

  // ── Content ────────────────────────────────────────────────────

  const content = (
    <Box sx={{ px: isModal ? 2.5 : 2, py: isModal ? 2 : 1.5 }}>

      {state.step === 'loading' && (
        <Box sx={{ py: 3 }}><LoadingDots mt={0} /></Box>
      )}

      {state.isCatchup && state.totalCatchup > 0 && isQuestionStep && (
        <CatchupProgress
          total={state.totalCatchup}
          remaining={state.catchupRemaining}
          isModal={isModal}
        />
      )}

      {state.errorMessage && (
        <Box sx={{
          mb: 1.5, px: 1.5, py: 1,
          borderRadius: `${radii.md}px`,
          bgcolor: colors.result.incorrectBg,
          border: `1px solid ${alpha(colors.result.incorrect, 0.25)}`,
        }}>
          <Typography sx={{ fontSize: '0.75rem', color: colors.result.incorrect, fontWeight: 500 }}>
            {state.errorMessage}
          </Typography>
        </Box>
      )}

      {state.step === 'response' && state.factResponse && (
        <DidYouKnow text={state.factResponse} isModal={isModal} />
      )}

      {(state.step === 'question' || state.step === 'submitting') && (
        <QuestionPanel
          question={state.question}
          questionDate={state.questionDate}
          isCatchup={state.isCatchup}
          isModal={isModal}
          answer={answer}
          setAnswer={setAnswer}
          submitting={state.step === 'submitting'}
          onSubmit={handleSubmit}
          onSkip={handleSkip}
          onDismiss={onDismiss}
          userId={userId}
          skipConfirm={skipConfirm}
          setSkipConfirm={setSkipConfirm}
        />
      )}

      {state.step === 'firstPerson' && (
        <FirstPersonCategoryPicker
          fpTheme={state.fpTheme}
          setFpTheme={actions.setFpTheme}
          onGenerate={actions.generateFpOptions}
          onSkip={actions.skipFirstPerson}
          isModal={isModal}
        />
      )}

      {state.step === 'firstPersonGen' && (
        <Box sx={{ py: 3 }}><LoadingDots mt={0} /></Box>
      )}

      {state.step === 'firstPersonPick' && (
        <FirstPersonOptionPicker
          options={state.fpOptions}
          onSelect={actions.selectFpQuestion}
          onRegenerate={actions.generateFpOptions}
          onChangeCategory={() => actions.setFpTheme('')}
          isModal={isModal}
        />
      )}

      {state.step === 'firstPersonDone' && <FirstPersonConfirmation />}
    </Box>
  );

  // ── Wrap ───────────────────────────────────────────────────────

  if (isModal) return <>{header}{content}</>;

  return (
    <Card sx={{
      mb: 2, overflow: 'hidden',
      borderRadius: `${radii.lg}px`,
      border: `1px solid ${alpha(colors.brand.primary, 0.18)}`,
      boxShadow: `0 2px 12px ${alpha('#000', 0.06)}`,
      bgcolor: colors.surface.card,
    }}>
      {header}
      {content}
    </Card>
  );
};

export default DailyFactCard;

// ─── Sub-components ─────────────────────────────────────────────

const CatchupProgress: React.FC<{ total: number; remaining: number; isModal: boolean }> = ({
  total, remaining, isModal,
}) => {
  const completed = total - remaining;
  const pct = total > 0 ? (completed / total) * 100 : 0;
  return (
    <Box sx={{ mb: 1.5 }}>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: isModal ? 5 : 3,
          borderRadius: `${radii.full}px`,
          bgcolor: alpha(colors.brand.secondary, 0.10),
          '& .MuiLinearProgress-bar': {
            borderRadius: `${radii.full}px`,
            bgcolor: colors.brand.secondary,
          },
        }}
      />
    </Box>
  );
};

const DidYouKnow: React.FC<{ text: string; isModal: boolean }> = ({ text, isModal }) => (
  <Fade in timeout={400}>
    <Box sx={{
      p: isModal ? 2 : 1.5,
      borderRadius: `${radii.md}px`,
      bgcolor: colors.result.correctBg,
      border: `1px solid ${alpha(colors.result.correct, 0.20)}`,
    }}>
      <Typography sx={{
        fontSize: '0.65rem', fontWeight: 800,
        color: colors.result.correct, textTransform: 'uppercase',
        letterSpacing: 0.6, mb: 0.5,
      }}>
        Did you know?
      </Typography>
      <Typography sx={{
        fontSize: isModal ? '0.9rem' : '0.78rem',
        lineHeight: 1.6, fontStyle: 'italic',
        color: colors.text.primary,
      }}>
        {text}
      </Typography>
    </Box>
  </Fade>
);

const DICTATION_TIP_KEY = 'factDictationTipDismissed';

const DictationTip: React.FC = () => {
  const [dismissed, setDismissed] = useState(() => {
    try { return window.sessionStorage.getItem(DICTATION_TIP_KEY) === '1'; }
    catch { return false; }
  });
  if (dismissed) return null;
  const handleDismiss = () => {
    try { window.sessionStorage.setItem(DICTATION_TIP_KEY, '1'); } catch { /* ok */ }
    setDismissed(true);
  };
  return (
    <Box
      sx={{
        // Sit flush against the input above. The input's bottom edge acts
        // as our top divider, so we drop our own top border to avoid a
        // double 1px line.
        display: 'flex', alignItems: 'center', gap: 1,
        px: 1.25, py: 0.65,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        border: `1px solid ${colors.border.medium}`,
        borderTop: `1px solid ${alpha(colors.brand.primary, 0.12)}`,
        bgcolor: alpha(colors.brand.primary, 0.05),
      }}
    >
      <KeyboardVoiceOutlinedIcon sx={{ fontSize: 15, color: colors.brand.primary, flexShrink: 0 }} />
      <Typography sx={{
        flex: 1,
        fontSize: '0.7rem',
        color: colors.text.secondary,
        lineHeight: 1.35,
      }}>
        Don&rsquo;t feel like typing? Tap the{' '}
        <Box component="span" sx={{ fontWeight: 700, color: colors.text.primary }}>microphone icon</Box>
        {' '}on your keyboard and just talk.
      </Typography>
      <IconButton
        onClick={handleDismiss}
        size="small"
        aria-label="Dismiss tip"
        sx={{
          p: 0.25, flexShrink: 0,
          color: colors.text.disabled,
          '&:hover': { color: colors.text.secondary, bgcolor: alpha(colors.brand.primary, 0.08) },
        }}
      >
        <CloseIcon sx={{ fontSize: 13 }} />
      </IconButton>
    </Box>
  );
};

interface QuestionPanelProps {
  question: string;
  questionDate: string | null;
  isCatchup: boolean;
  isModal: boolean;
  answer: string;
  setAnswer: (s: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  /** Permanent skip — marks the question as skipped on the server. */
  onSkip: () => void;
  /** "Close this for now" — same as the modal X. No API call. */
  onDismiss?: () => void;
  userId: string;
  skipConfirm: boolean;
  setSkipConfirm: (b: boolean) => void;
}

const QuestionPanel: React.FC<QuestionPanelProps> = ({
  question, questionDate, isCatchup, isModal, answer, setAnswer,
  submitting, onSubmit, onSkip, onDismiss, userId, skipConfirm, setSkipConfirm,
}) => (
  <>
    {isCatchup && questionDate && (
      <Typography sx={{
        fontSize: '0.62rem', fontWeight: 800,
        color: colors.brand.secondaryDark,
        bgcolor: alpha(colors.brand.secondary, 0.10),
        display: 'inline-block', px: 1, py: 0.3,
        borderRadius: `${radii.sm}px`, mb: 1,
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        {daysAgoText(questionDate)}
      </Typography>
    )}

    <Typography sx={{
      fontSize: isModal ? '1.1rem' : '0.95rem',
      fontWeight: 600, lineHeight: 1.5, mb: 2,
      color: colors.text.primary,
    }}>
      {question}
    </Typography>

    {/* Wrap input + tip so they read as one shape: input loses its bottom
        radius and the tip extends underneath sharing the same edges. */}
    <Box sx={{
      '& .MuiOutlinedInput-root': {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      },
    }}>
      <FactAnswerInput
        value={answer}
        onChange={setAnswer}
        onSubmit={onSubmit}
        userId={userId}
        disabled={submitting}
        placeholder="Type your answer..."
        autoFocus={isModal}
      />
      <DictationTip />
    </Box>

    <Button
      variant="contained"
      fullWidth
      onClick={onSubmit}
      disabled={submitting || !answer.trim()}
      startIcon={submitting ? null : <SendIcon />}
      sx={{
        mt: 2, py: 1.5,
        borderRadius: `${radii.md}px`,
        textTransform: 'none',
        fontWeight: 700,
        fontSize: isModal ? '1rem' : '0.9rem',
        bgcolor: colors.brand.primary,
        boxShadow: `0 2px 8px ${alpha(colors.brand.primary, 0.25)}`,
        '&:hover': {
          bgcolor: colors.brand.primaryDark,
          boxShadow: `0 4px 12px ${alpha(colors.brand.primary, 0.35)}`,
        },
        '&.Mui-disabled': {
          bgcolor: alpha(colors.brand.primary, 0.18),
          color: colors.text.inverse,
        },
      }}
    >
      {submitting ? 'Sending...' : 'Submit Answer'}
    </Button>

    {/*
      Two secondary actions, well below Submit:
        - "I don't want to answer this" → real skip, marks the day as skipped
          on the server. Confirm-then-act so it can't fire by accident.
        - "Skip for now" → pure dismiss, same as the modal X. Comes back
          on the next visit.
    */}
    <Box sx={{ textAlign: 'center', mt: 1.5, minHeight: 28 }}>
      {!skipConfirm ? (
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 0.5, flexWrap: 'wrap',
        }}>
          <Button
            onClick={() => setSkipConfirm(true)}
            disabled={submitting}
            size="small"
            sx={{
              textTransform: 'none', fontSize: '0.75rem', fontWeight: 500,
              color: colors.text.disabled,
              '&:hover': { color: colors.text.secondary, bgcolor: 'transparent' },
            }}
          >
            I don&rsquo;t want to answer this
          </Button>
          {onDismiss && (
            <>
              <Box sx={{
                width: '3px', height: '3px', borderRadius: '50%',
                bgcolor: colors.text.disabled, opacity: 0.5,
              }} />
              <Button
                onClick={onDismiss}
                disabled={submitting}
                size="small"
                sx={{
                  textTransform: 'none', fontSize: '0.75rem', fontWeight: 500,
                  color: colors.text.disabled,
                  '&:hover': { color: colors.text.secondary, bgcolor: 'transparent' },
                }}
              >
                Skip for now
              </Button>
            </>
          )}
        </Box>
      ) : (
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: '0.72rem', color: colors.text.secondary }}>
            You won&rsquo;t see this again. Sure?
          </Typography>
          <Button
            onClick={onSkip}
            disabled={submitting}
            size="small"
            sx={{
              textTransform: 'none', fontSize: '0.72rem', fontWeight: 700,
              color: colors.result.incorrect, py: 0, minWidth: 0, px: 1,
              '&:hover': { bgcolor: alpha(colors.result.incorrect, 0.06) },
            }}
          >
            Yes, skip it
          </Button>
          <Button
            onClick={() => setSkipConfirm(false)}
            disabled={submitting}
            size="small"
            sx={{
              textTransform: 'none', fontSize: '0.72rem', fontWeight: 700,
              color: colors.brand.primary, py: 0, minWidth: 0, px: 1,
              '&:hover': { bgcolor: alpha(colors.brand.primary, 0.06) },
            }}
          >
            No
          </Button>
        </Box>
      )}
    </Box>
  </>
);

interface FirstPersonCategoryPickerProps {
  fpTheme: string;
  setFpTheme: (theme: string) => void;
  onGenerate: () => void;
  onSkip: () => void;
  isModal: boolean;
}

const FirstPersonCategoryPicker: React.FC<FirstPersonCategoryPickerProps> = ({
  fpTheme, setFpTheme, onGenerate, onSkip, isModal,
}) => (
  <Box>
    <Typography sx={{
      fontSize: isModal ? '0.9rem' : '0.8rem',
      color: colors.text.secondary, mb: 1.5, lineHeight: 1.5,
    }}>
      Create a question for the whole family to answer today.
    </Typography>

    <Typography sx={{
      fontSize: '0.62rem', fontWeight: 800,
      color: colors.text.disabled, mb: 0.75,
      textTransform: 'uppercase', letterSpacing: 0.6,
    }}>
      Pick a category
    </Typography>

    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {FIRST_PERSON_CATEGORIES.map(cat => {
        const selected = fpTheme === cat.label;
        return (
          <Box key={cat.label}
            onClick={() => setFpTheme(selected ? '' : cat.label)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              px: 1.25, py: 0.5,
              borderRadius: `${radii.full}px`,
              cursor: 'pointer', minHeight: 36,
              transition: 'background-color 0.15s, border-color 0.15s, color 0.15s',
              fontSize: isModal ? '0.78rem' : '0.7rem',
              bgcolor: selected ? alpha(colors.brand.primary, 0.10) : 'transparent',
              border: `1px solid ${selected ? colors.brand.primary : alpha(colors.brand.primary, 0.18)}`,
              color: selected ? colors.brand.primary : colors.text.secondary,
              fontWeight: selected ? 700 : 500,
              '&:hover': {
                bgcolor: alpha(colors.brand.primary, 0.06),
                borderColor: alpha(colors.brand.primary, 0.4),
              },
            }}>
            <span style={{ fontSize: '1rem' }}>{cat.emoji}</span>
            {cat.label}
          </Box>
        );
      })}
    </Box>

    <TextField
      size="small" fullWidth
      value={CATEGORY_LABELS.includes(fpTheme) ? '' : fpTheme}
      onChange={(e) => setFpTheme(e.target.value)}
      placeholder="Or type your own theme..."
      sx={{
        mt: 1.5,
        '& .MuiOutlinedInput-root': {
          borderRadius: `${radii.md}px`,
          fontSize: '0.85rem', minHeight: 48,
        },
      }}
    />

    <Button
      variant="contained" fullWidth
      onClick={onGenerate}
      startIcon={<AutoAwesomeIcon />}
      sx={{
        mt: 1.5,
        borderRadius: `${radii.md}px`,
        textTransform: 'none', fontWeight: 700,
        py: 1.25, fontSize: '0.9rem',
        bgcolor: colors.brand.primary,
        '&:hover': { bgcolor: colors.brand.primaryDark },
      }}>
      Generate Questions
    </Button>

    <Button
      size="small" onClick={onSkip}
      sx={{
        fontSize: '0.72rem', textTransform: 'none',
        color: colors.text.disabled,
        mt: 1, display: 'block', mx: 'auto',
      }}>
      Skip — let someone else create
    </Button>
  </Box>
);

interface FirstPersonOptionPickerProps {
  options: QuestionOption[];
  onSelect: (q: string) => void;
  onRegenerate: () => void;
  onChangeCategory: () => void;
  isModal: boolean;
}

const FirstPersonOptionPicker: React.FC<FirstPersonOptionPickerProps> = ({
  options, onSelect, onRegenerate, onChangeCategory, isModal,
}) => (
  <Box>
    <Typography sx={{
      fontSize: '0.62rem', fontWeight: 800,
      color: colors.text.secondary, mb: 1,
      textTransform: 'uppercase', letterSpacing: 0.6,
    }}>
      Pick a question
    </Typography>

    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {options.map((opt, i) => (
        <Box key={i}
          onClick={() => onSelect(opt.question)}
          sx={{
            px: 1.5, py: 1.25,
            borderRadius: `${radii.md}px`,
            minHeight: 48,
            border: `1px solid ${alpha(colors.brand.primary, 0.18)}`,
            cursor: 'pointer',
            transition: 'all 0.15s',
            '&:hover': {
              bgcolor: alpha(colors.brand.primary, 0.06),
              borderColor: alpha(colors.brand.primary, 0.35),
            },
          }}>
          <Typography sx={{
            fontSize: isModal ? '0.92rem' : '0.85rem',
            fontWeight: 500, lineHeight: 1.5,
            color: colors.text.primary,
          }}>
            {opt.question}
          </Typography>
          {opt.theme && (
            <Chip label={opt.theme} size="small" sx={{
              mt: 0.5, height: 20, fontSize: '0.62rem',
              bgcolor: alpha(colors.brand.primary, 0.08),
              color: colors.brand.primary,
            }} />
          )}
        </Box>
      ))}
    </Box>

    <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
      <Button size="small" fullWidth variant="outlined"
        onClick={onRegenerate}
        startIcon={<RefreshIcon />}
        sx={{
          borderRadius: `${radii.md}px`,
          textTransform: 'none', fontWeight: 600,
          borderColor: colors.brand.primary,
          color: colors.brand.primary,
        }}>
        Regenerate
      </Button>
      <Button size="small" fullWidth variant="text"
        onClick={onChangeCategory}
        sx={{
          borderRadius: `${radii.md}px`,
          textTransform: 'none',
          color: colors.text.secondary,
        }}>
        Change category
      </Button>
    </Box>
  </Box>
);

const FirstPersonConfirmation: React.FC = () => (
  <Box sx={{ textAlign: 'center', py: 3 }}>
    <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>{'\u2728'}</Typography>
    <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 0.25, color: colors.text.primary }}>
      Your question is live!
    </Typography>
    <Typography sx={{ fontSize: '0.8rem', color: colors.text.secondary }}>
      Now answer it yourself...
    </Typography>
  </Box>
);
