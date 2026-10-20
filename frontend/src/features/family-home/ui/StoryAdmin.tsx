/**
 * Admin › Family: the family's story as it reads on Us, and a
 * button to write it again from everyone's latest answers.
 */

import { capitalized } from '@family-trivia/shared';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import type React from 'react';
import ReactMarkdown from 'react-markdown';
import { useCircleWords } from '../../../entities/circle';
import { ApiError } from '../../../shared/api/ApiService';
import { useFamilyStory, useWriteStory } from '../model/familyStory';

export const StoryAdmin: React.FC = () => {
  const { words } = useCircleWords();
  const story = useFamilyStory().data ?? null;
  const writing = useWriteStory();
  const busy = writing.isPending;
  const problem = writing.error
    ? writing.error instanceof ApiError
      ? writing.error.message
      : 'The story could not be written right now.'
    : null;
  const write = () => writing.mutate();

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1 }}>
        <AutoStoriesIcon sx={{ color: 'primary.main' }} />
        <Typography sx={{ fontWeight: 700, flex: 1 }}>{capitalized(words.whose)} story</Typography>
        <Button variant="contained" onClick={write} disabled={busy}>
          {busy ? 'Writing…' : story?.markdown ? 'Write it again' : 'Write the story'}
        </Button>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        A few paragraphs at the top of Us, written from everyone's answers. It leaves out anyone who
        asked not to be named, and never mentions former partners.
        {story?.generatedAt && ` Last written ${new Date(story.generatedAt).toLocaleDateString()}.`}
      </Typography>
      {problem && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {problem}
        </Alert>
      )}
      {story?.markdown && (
        <Box
          sx={{
            '& p': { mt: 0, mb: 1, lineHeight: 1.6 },
            borderLeft: 3,
            borderColor: 'divider',
            pl: 1.5,
          }}
        >
          <ReactMarkdown>{story.markdown}</ReactMarkdown>
        </Box>
      )}
    </Paper>
  );
};
