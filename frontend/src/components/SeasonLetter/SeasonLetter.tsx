/**
 * The letter a family reads when a season starts or ends: the admin's own
 * words in Markdown, and a photo if they chose one. It looks like a letter on
 * paper, not a system dialog, because it usually is one: a thank-you, a
 * welcome back, sometimes a remembrance. Each person sees it once.
 */

import type { SeasonLetter as Letter } from '@family-trivia/shared';
import {
  alpha,
  Box,
  Button,
  Dialog,
  Fade,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLetterPaper } from '../../shared/design-system';

interface SeasonLetterProps {
  letter: Letter;
  seasonName?: string;
  onClose: () => void;
}

/** The letter itself: heading, photo, ornament and the Markdown. Also the editor's preview. */
export const LetterPaper: React.FC<{ heading: string; markdown: string; imageUrl?: string }> = ({
  heading,
  markdown,
  imageUrl,
}) => {
  const paper = useLetterPaper();
  return (
    <>
      <Typography
        id="season-letter-title"
        component="h2"
        sx={{
          fontFamily: paper.serif,
          fontSize: '0.95rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: paper.inkSoft,
        }}
      >
        {heading}
      </Typography>

      {imageUrl && (
        <Box
          component="img"
          src={imageUrl}
          alt=""
          sx={{
            mt: 4,
            width: '100%',
            maxWidth: 520,
            borderRadius: 0.5,
            boxShadow: `0 12px 32px -12px ${paper.shadow}, 0 4px 10px -4px ${alpha(paper.ink, 0.25)}`,
          }}
        />
      )}

      <Box
        aria-hidden
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
          my: 3,
          color: paper.rule,
          '&::before, &::after': {
            content: '""',
            flex: '0 1 90px',
            height: '1px',
            bgcolor: paper.rule,
            opacity: 0.7,
          },
        }}
      >
        ❦
      </Box>

      <Box
        sx={{
          textAlign: 'left',
          fontSize: { xs: '1.05rem', sm: '1.12rem' },
          lineHeight: 1.65,
          '& p': { my: 1.5 },
          '& h1, & h2, & h3': {
            fontFamily: paper.serif,
            fontWeight: 400,
            textAlign: 'center',
            my: 2,
          },
          // The line right under a heading (dates, a subtitle) sits centered with it.
          '& h1 + p, & h2 + p, & h3 + p': { textAlign: 'center', mt: -1 },
          '& blockquote': {
            fontStyle: 'italic',
            textAlign: 'center',
            mx: 0,
            my: 2.5,
            color: paper.ink,
          },
          '& a': { color: paper.ink },
          '& img': { maxWidth: '100%', borderRadius: 0.5 },
          '& ul, & ol': { pl: 3 },
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </Box>
    </>
  );
};

export const SeasonLetter: React.FC<SeasonLetterProps> = ({ letter, seasonName, onClose }) => {
  const paper = useLetterPaper();
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  const heading =
    letter.title ||
    (letter.kind === 'start'
      ? `${seasonName ?? 'A new season'} begins`
      : `${seasonName ?? 'The season'} has ended`);

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="sm"
      fullWidth
      slots={{ transition: Fade }}
      slotProps={{
        transition: { timeout: 500 },
        paper: {
          sx: {
            bgcolor: paper.paper,
            color: paper.ink,
            backgroundImage: `radial-gradient(circle at 50% 0%, ${paper.glow} 0%, transparent 60%), radial-gradient(circle at 0% 100%, ${paper.edge} 0%, transparent 55%)`,
            borderRadius: fullScreen ? 0 : 1,
          },
        },
      }}
      aria-labelledby="season-letter-title"
    >
      <Box
        sx={{
          px: { xs: 3, sm: 6 },
          py: { xs: 5, sm: 6 },
          textAlign: 'center',
          fontFamily: paper.serif,
        }}
      >
        <LetterPaper heading={heading} markdown={letter.markdown} imageUrl={letter.imageUrl} />

        <Button
          onClick={onClose}
          sx={{
            mt: 4,
            px: 4,
            color: paper.ink,
            borderColor: paper.rule,
            fontFamily: paper.serif,
            letterSpacing: '0.06em',
            '&:hover': { borderColor: paper.inkSoft, bgcolor: alpha(paper.ink, 0.04) },
          }}
          variant="outlined"
        >
          Close
        </Button>
      </Box>
    </Dialog>
  );
};
