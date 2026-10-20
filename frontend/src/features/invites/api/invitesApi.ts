import type {
  Invite,
  InviteLifetime,
  InvitePreview,
  JoinDetails,
  MyCircle,
  PendingJoin,
} from '@family-trivia/shared';
import { publicRequest } from '../../../api/modules/auth';
import { apiService } from '../../../shared/api/ApiService';

export interface InviteSession {
  token: string;
  userId: string;
  circleId: string;
  circles: MyCircle[];
  email: string;
}

export interface AcceptReply {
  pending: boolean;
  circleName?: string;
  session: InviteSession | null;
}

export interface NewInvite {
  forUserId?: string;
  lifetime: InviteLifetime;
  maxUses: number | null;
  approval: boolean;
}

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const invitesApi = {
  // Before sign-in
  preview: (token: string) =>
    publicRequest<InvitePreview>(`/invite?token=${encodeURIComponent(token)}`),
  accept: (token: string, googleIdToken: string, details?: JoinDetails) =>
    publicRequest<AcceptReply>('/invite/accept', { token, googleIdToken, details }),

  // Admin › Circles
  list: () => apiService.request<{ invites: Invite[]; joins: PendingJoin[] }>('/admin/invites'),
  create: (i: NewInvite) =>
    apiService.request<{ invite: Invite }>(
      '/admin/invites',
      json({
        ...(i.forUserId ? { for: { userId: i.forUserId } } : {}),
        lifetime: i.lifetime,
        maxUses: i.maxUses,
        approval: i.approval,
      }),
    ),
  revoke: (token: string) =>
    apiService.request<{ revoked: string }>('/admin/invites/revoke', json({ token })),
  decide: (id: string, approve: boolean) =>
    apiService.request<{ ok: boolean; userId?: string }>(
      '/admin/joins/decide',
      json({ id, approve }),
    ),
};

/** The link people open: this site's /join page with the token. */
export const inviteLink = (token: string) => `${window.location.origin}/join?t=${token}`;
