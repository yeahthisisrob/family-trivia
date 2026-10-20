/**
 * After a plan (docs/decisions/0026): for two weeks after the day, the people
 * who were in it are asked how it went. A few words, shared with each other;
 * or skip, and it stops asking.
 */
import type { AfterPlan } from '@family-trivia/shared';
import { Box, Button, Card, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { Face } from '../../../entities/person';
import { useAfterPlans } from '../model/usePlans';

const when = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

interface ViewProps {
  me: string;
  nameOf: (id: string) => string;
  plans: AfterPlan[];
  onRemember: (id: string, text: string) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
}

const One: React.FC<{ plan: AfterPlan } & Omit<ViewProps, 'plans'>> = ({
  plan,
  me,
  nameOf,
  onRemember,
  onSkip,
}) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const mineSaid = plan.memories.some((m) => m.by === me);
  const others = plan.who.filter((w) => w !== me);
  const go = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
      setText('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card sx={{ p: 2.5, mb: 2, borderRadius: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>
        How was {plan.drop.title}?
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        {when(plan.drop.start)}
        {others.length ? `, with ${others.map(nameOf).join(', ')}` : ''}
      </Typography>
      {plan.memories.length > 0 && (
        <Stack spacing={1.25} sx={{ mb: 1.5 }}>
          {plan.memories.map((m) => (
            <Stack
              key={`${m.by}${m.at}`}
              direction="row"
              spacing={1}
              sx={{ alignItems: 'flex-start' }}
            >
              <Face id={m.by} name={nameOf(m.by)} size={28} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {m.by === me ? 'You' : nameOf(m.by)}
                </Typography>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      )}
      <TextField
        fullWidth
        multiline
        minRows={2}
        size="small"
        placeholder={mineSaid ? 'Add something else' : 'What do you want to remember?'}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 1000))}
      />
      <Stack direction="row" spacing={1} sx={{ mt: 1, justifyContent: 'flex-end' }}>
        <Button color="inherit" disabled={busy} onClick={() => void go(() => onSkip(plan.drop.id))}>
          {mineSaid ? 'Done' : 'Skip'}
        </Button>
        <Button
          variant="contained"
          disabled={busy || !text.trim()}
          onClick={() => void go(() => onRemember(plan.drop.id, text))}
        >
          Share
        </Button>
      </Stack>
    </Card>
  );
};

export const AfterCardView: React.FC<ViewProps> = (props) => (
  <>
    {props.plans.slice(0, 2).map((p) => (
      <One key={p.drop.id} plan={p} {...props} />
    ))}
  </>
);

/** Home's cards for plans that just happened. */
export const AfterCard: React.FC<{ me: string; nameOf: (id: string) => string }> = ({
  me,
  nameOf,
}) => {
  const { plans, remember, skip } = useAfterPlans();
  return (
    <AfterCardView me={me} nameOf={nameOf} plans={plans} onRemember={remember} onSkip={skip} />
  );
};
