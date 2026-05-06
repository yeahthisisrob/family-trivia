// LoginScreen — Google OAuth with passphrase-based account linking.
//
// Flow:
//   1. "Sign in with Google" → if already linked, straight in.
//   2. If not linked → "Enter your passphrase" → passphrase identifies
//      the user, links the Google account, done forever.

import GoogleIcon from '@mui/icons-material/Google';
import {
  Alert, Box, Button, Card, TextField, Typography,
  alpha, useTheme,
} from '@mui/material';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import React, { useCallback, useState } from 'react';

import { loginWithGoogle, linkGoogleAccount } from '../../api/modules/auth';
import { colors } from '../../shared/design-system/tokens/colors';
import { radii } from '../../shared/design-system/tokens/radii';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

const logger = createLogger('LoginScreen');

type LoginState = 'idle' | 'linking' | 'loading';

interface LoginScreenProps {
  googleClientId: string;
  onActivate: (userId: string, valid: boolean, token: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ googleClientId, onActivate }) => {
  const theme = useTheme();

  const [state, setState] = useState<LoginState>('idle');
  const [passphrase, setPassphrase] = useState('');
  const [pendingGoogleToken, setPendingGoogleToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1: User taps "Sign in with Google"
  const handleGoogleSuccess = useCallback(async (credentialResponse: { credential?: string }) => {
    const idToken = credentialResponse.credential;
    if (!idToken) { setError('Google sign-in failed'); return; }

    setState('loading');
    setError(null);

    try {
      const result = await loginWithGoogle(idToken);
      onActivate(result.userId, true, result.token);
    } catch (err: any) {
      if (err?.errorType === 'NOT_LINKED') {
        setPendingGoogleToken(idToken);
        setState('linking');
        setError(null);
      } else {
        setError(err?.message || 'Sign-in failed. Please try again.');
        setState('idle');
      }
    }
  }, [onActivate]);

  // Step 2: Enter passphrase → backend resolves who you are → links
  const handleLink = useCallback(async () => {
    if (!passphrase.trim() || !pendingGoogleToken) return;

    setState('loading');
    setError(null);

    try {
      // Backend resolves userId from the passphrase — no userId needed.
      const result = await linkGoogleAccount(pendingGoogleToken, passphrase);
      onActivate(result.userId, true, result.token);
    } catch (err: any) {
      if (err?.errorType === 'INVALID_PASSPHRASE') {
        setError('Wrong passphrase. Try again.');
      } else if (err?.errorType === 'USER_ALREADY_LINKED') {
        setError('This family member is already linked to another Google account. Contact the administrator for help.');
      } else {
        setError(err?.message || 'Linking failed. Please try again.');
      }
      setState('linking');
    }
  }, [passphrase, pendingGoogleToken, onActivate]);

  const isLoading = state === 'loading';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <Box sx={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(160deg, ${alpha(colors.brand.primary, 0.06)} 0%, ${alpha(colors.brand.secondary, 0.04)} 100%)`,
        p: 2,
      }}>
        <Box sx={{ width: '100%', maxWidth: 360 }}>
          {/* Logo */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography sx={{
              fontSize: '2rem', fontWeight: 900, letterSpacing: -0.5,
              background: `linear-gradient(135deg, ${colors.brand.primary}, ${colors.brand.secondary})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Family Trivia
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
              {state === 'linking'
                ? 'First time? Enter your passphrase to link your account.'
                : 'Sign in to play'}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: `${radii.md}px` }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* ── Idle: Google sign-in ── */}
          {state === 'idle' && (
            <Card sx={{
              borderRadius: 3, overflow: 'hidden',
              boxShadow: `0 4px 20px ${alpha('#000', 0.08)}`,
            }}>
              <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google sign-in was cancelled')}
                  size="large"
                  width="320"
                  text="signin_with"
                  shape="rectangular"
                  theme="outline"
                />
                <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', mt: 2, textAlign: 'center' }}>
                  First time? You'll enter your passphrase after signing in with Google.
                </Typography>
              </Box>
            </Card>
          )}

          {/* ── Loading ── */}
          {isLoading && (
            <Card sx={{ borderRadius: 3, p: 3, textAlign: 'center' }}>
              <LoadingDots />
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 1 }}>
                Signing in…
              </Typography>
            </Card>
          )}

          {/* ── Linking: passphrase only ── */}
          {state === 'linking' && (
            <Card sx={{ borderRadius: 3, p: 2.5 }}>
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 2, textAlign: 'center' }}>
                Enter your personal passphrase to link this Google account
              </Typography>
              <TextField
                fullWidth
                size="small"
                type="password"
                placeholder="Your passphrase"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLink()}
                disabled={isLoading}
                autoFocus
                sx={{ mb: 2 }}
              />
              <Button
                fullWidth
                variant="contained"
                disabled={!passphrase.trim() || isLoading}
                onClick={handleLink}
                sx={{
                  py: 1.25, borderRadius: `${radii.md}px`,
                  fontWeight: 700, fontSize: '0.85rem',
                  textTransform: 'none',
                }}
              >
                Link & Sign In
              </Button>
              <Button
                size="small"
                onClick={() => { setState('idle'); setError(null); setPendingGoogleToken(null); setPassphrase(''); }}
                sx={{ mt: 1.5, display: 'block', mx: 'auto', fontSize: '0.7rem', color: 'text.disabled' }}
              >
                Back
              </Button>
            </Card>
          )}
        </Box>
      </Box>
    </GoogleOAuthProvider>
  );
};

export default LoginScreen;
