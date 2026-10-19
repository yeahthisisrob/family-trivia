import type { InvitePreview } from '@family-trivia/shared';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import { Alert, alpha, Box, Button, Card, TextField, Typography, useTheme } from '@mui/material';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import type React from 'react';
import { useEffect, useState } from 'react';
import { rememberCircles } from '../../../api/modules/auth';
import { LoadingDots } from '../../../components/ui/feedback';
import { KIND_ICON, KIND_LINE } from '../../../entities/circle';
import { saveSession } from '../../../session';
import { colors } from '../../../shared/design-system/tokens/colors';
import { type InviteSession, invitesApi } from '../api/invitesApi';

const GONE: Record<Exclude<InvitePreview['state'], 'open'>, string> = {
  expired: 'This invite has expired.',
  'used-up': 'This invite has already been used.',
  revoked: 'This invite was taken back.',
};

const ERRORS: Record<string, string> = {
  USER_ALREADY_LINKED: 'This invite is linked to another Google account. Ask whoever sent it.',
  INVITE_EXPIRED: GONE.expired,
  INVITE_USED_UP: GONE['used-up'],
  INVITE_REVOKED: GONE.revoked,
};

type Step =
  | { at: 'loading' }
  | { at: 'missing' }
  | { at: 'gone'; why: string }
  | { at: 'open'; preview: InvitePreview }
  | { at: 'joining' }
  | { at: 'waiting'; circleName: string; session: InviteSession | null };

/** Start the app as this person, in the circle they just joined. */
function enter(session: InviteSession) {
  saveSession(session.userId, session.token, session.email);
  rememberCircles(session);
  window.location.assign('/');
}

interface Props {
  token: string;
  googleClientId: string;
}

/**
 * The page an invite link opens (/join?t=…): which circle, a name and a
 * line about how you know everyone, then Google. Nothing about any other
 * circle is ever shown here.
 */
export const JoinScreen: React.FC<Props> = ({ token, googleClientId }) => {
  const theme = useTheme();
  const [step, setStep] = useState<Step>({ at: 'loading' });
  const [name, setName] = useState('');
  const [howWeMet, setHowWeMet] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invitesApi
      .preview(token)
      .then((preview) =>
        setStep(
          preview.state === 'open'
            ? { at: 'open', preview }
            : { at: 'gone', why: GONE[preview.state] },
        ),
      )
      .catch(() => setStep({ at: 'missing' }));
  }, [token]);

  const accept = async (googleIdToken: string) => {
    const before = step;
    setStep({ at: 'joining' });
    setError(null);
    try {
      const forSomeone = before.at === 'open' && before.preview.forName;
      const reply = await invitesApi.accept(
        token,
        googleIdToken,
        forSomeone ? undefined : { name: name.trim(), howWeMet: howWeMet.trim() || undefined },
      );
      if (reply.pending)
        setStep({ at: 'waiting', circleName: reply.circleName ?? '', session: reply.session });
      else if (reply.session) enter(reply.session);
    } catch (err) {
      const type = (err as { errorType?: string }).errorType ?? '';
      setError(ERRORS[type] ?? 'Joining failed. Please try again.');
      setStep(before);
    }
  };

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          p: 2,
          background: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
        }}
      >
        <Card
          sx={{
            width: '100%',
            maxWidth: 400,
            borderRadius: 4,
            p: { xs: 3, sm: 4 },
            boxShadow: `0 12px 40px ${alpha(colors.scrim, 0.12)}`,
          }}
        >
          {step.at === 'loading' || step.at === 'joining' ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <LoadingDots />
              {step.at === 'joining' && (
                <Typography sx={{ mt: 1, color: 'text.secondary' }}>Joining…</Typography>
              )}
            </Box>
          ) : step.at === 'missing' || step.at === 'gone' ? (
            <Message
              icon={<LinkOffRoundedIcon />}
              title={step.at === 'gone' ? step.why : "This invite link doesn't work."}
              body="Ask whoever sent it for a new one."
            />
          ) : step.at === 'waiting' ? (
            <>
              <Message
                icon={<HourglassTopRoundedIcon />}
                title="You're on the list"
                body={`Someone in ${step.circleName || 'the circle'} will let you in soon. Sign in again any time to check.`}
              />
              {step.session && (
                <Button
                  fullWidth
                  variant="outlined"
                  sx={{ mt: 3 }}
                  onClick={() => step.session && enter(step.session)}
                >
                  Go to your other circles
                </Button>
              )}
            </>
          ) : (
            <Open
              preview={step.preview}
              name={name}
              howWeMet={howWeMet}
              error={error}
              onName={setName}
              onHowWeMet={setHowWeMet}
              onGoogle={accept}
              onGoogleError={() => setError('Google sign-in was cancelled')}
              dark={theme.palette.mode === 'dark'}
            />
          )}
        </Card>
      </Box>
    </GoogleOAuthProvider>
  );
};

const Message: React.FC<{ icon: React.ReactNode; title: string; body: string }> = ({
  icon,
  title,
  body,
}) => (
  <Box sx={{ textAlign: 'center', py: 2 }}>
    <Box sx={{ color: 'text.secondary', '& svg': { fontSize: 40 } }}>{icon}</Box>
    <Typography variant="h6" sx={{ fontWeight: 700, mt: 1 }}>
      {title}
    </Typography>
    <Typography sx={{ color: 'text.secondary', mt: 1 }}>{body}</Typography>
  </Box>
);

const Open: React.FC<{
  preview: InvitePreview;
  name: string;
  howWeMet: string;
  error: string | null;
  onName: (v: string) => void;
  onHowWeMet: (v: string) => void;
  onGoogle: (idToken: string) => void;
  onGoogleError: () => void;
  dark: boolean;
}> = ({ preview, name, howWeMet, error, onName, onHowWeMet, onGoogle, onGoogleError, dark }) => {
  const kind = preview.circle?.kind ?? 'family';
  const Icon = KIND_ICON[kind];
  const forSomeone = !!preview.forName;
  const ready = forSomeone || name.trim().length > 0;

  return (
    <>
      <Box sx={{ textAlign: 'center' }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            mx: 'auto',
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '& svg': { fontSize: 34 },
          }}
        >
          <Icon />
        </Box>
        <Typography sx={{ mt: 2, color: 'text.secondary', fontWeight: 600 }}>
          You're invited to
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.15 }}>
          {preview.circle?.name}
        </Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>{KIND_LINE[kind]}</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 3 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {forSomeone ? (
          <Typography sx={{ textAlign: 'center' }}>
            This invite is for <b>{preview.forName}</b>. Sign in to take your place.
          </Typography>
        ) : (
          <>
            <TextField
              autoFocus
              fullWidth
              label="What should everyone call you?"
              value={name}
              onChange={(e) => onName(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 60 } }}
            />
            {kind !== 'family' && (
              <TextField
                fullWidth
                label="How do you know everyone?"
                placeholder="College roommates, the old job…"
                helperText="Optional"
                value={howWeMet}
                onChange={(e) => onHowWeMet(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
            )}
          </>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center', minHeight: 44 }}>
          {ready ? (
            <GoogleLogin
              onSuccess={(r) => r.credential && onGoogle(r.credential)}
              onError={onGoogleError}
              size="large"
              theme={dark ? 'filled_black' : 'outline'}
              text="continue_with"
              shape="pill"
              width="300"
            />
          ) : (
            <Typography sx={{ color: 'text.disabled', fontSize: '0.85rem', alignSelf: 'center' }}>
              Add your name to continue
            </Typography>
          )}
        </Box>
        {preview.approval && !forSomeone && (
          <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', textAlign: 'center' }}>
            Someone in the circle will let you in after you join.
          </Typography>
        )}
      </Box>
    </>
  );
};
