/**
 * POST /auth/google — Google OAuth login + first-time account linking.
 *
 * Two modes:
 *   Returning user:  { googleIdToken }              → email lookup → JWT
 *   First-time link: { googleIdToken, passphrase }  → passphrase identifies user → link → JWT
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { verifyGoogleToken, signJwt } from '../services/auth';
import { getJson, putJson } from '../services/s3';

const AUTH_MAP_KEY = 'config/google-auth-map.json';
const USERS_CONFIG_KEY = 'config/users.json';

type AuthMap = Record<string, string>; // email → userId

interface UsersConfig {
  users: Record<string, { group: string; color: string; passphrase: string }>;
}

export async function authGoogle(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { googleIdToken, passphrase } = body as {
    googleIdToken?: string;
    passphrase?: string;
  };

  if (!googleIdToken) {
    return errorResponse('Missing googleIdToken', 400);
  }

  // 1. Verify the Google ID token
  const googleUser = await verifyGoogleToken(googleIdToken);
  if (!googleUser) {
    return errorResponse('Invalid or expired Google token', 401);
  }

  // 2. Load the email → userId mapping
  const authMap: AuthMap = (await getJson<AuthMap>(AUTH_MAP_KEY)) || {};

  // ── Returning user: email already linked ──────────────────────
  const existingUserId = authMap[googleUser.email];
  if (existingUserId) {
    const token = await signJwt({ sub: existingUserId, email: googleUser.email });
    logger.info('Google auth: returning user', { email: googleUser.email, userId: existingUserId });
    return successResponse({
      token,
      userId: existingUserId,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      isNewLink: false,
    });
  }

  // ── First-time linking: passphrase identifies the user ────────
  if (!passphrase) {
    return errorResponse('Account not linked', 401, undefined, 'NOT_LINKED');
  }

  // Load users config and find who this passphrase belongs to
  const usersConfig = await getJson<UsersConfig>(USERS_CONFIG_KEY);
  if (!usersConfig?.users) {
    return errorResponse('Server configuration error', 500);
  }

  // Match passphrase to userId (case-insensitive)
  const normalizedInput = passphrase.trim().toLowerCase();
  const matchedEntry = Object.entries(usersConfig.users).find(
    ([, userData]) => userData.passphrase?.toLowerCase() === normalizedInput,
  );

  if (!matchedEntry) {
    return errorResponse('Invalid passphrase', 401, undefined, 'INVALID_PASSPHRASE');
  }

  const [userId] = matchedEntry;

  // Check this userId isn't already linked to a different email
  const emailForUser = Object.entries(authMap).find(([, uid]) => uid === userId);
  if (emailForUser) {
    return errorResponse(
      'This family member is already linked to a different Google account. Contact the admin.',
      409,
      undefined,
      'USER_ALREADY_LINKED',
    );
  }

  // Link the account
  authMap[googleUser.email] = userId;
  await putJson(AUTH_MAP_KEY, authMap);

  const token = await signJwt({ sub: userId, email: googleUser.email });
  logger.info('Google auth: new link', { email: googleUser.email, userId });

  return successResponse({
    token,
    userId,
    email: googleUser.email,
    name: googleUser.name,
    picture: googleUser.picture,
    isNewLink: true,
  });
}
