// src/hooks/useGetInvitation.ts
// ─────────────────────────────────────────────────────────────────────────────
// Query hook for GET /api/v1/invitations/:token.
// Public — no auth required.
//
// Used by InvitationAcceptPage to fetch workspace/inviter details before
// the user decides to accept. The token itself is the secret.
//
// Error codes:
//   INVITATION_INVALID  → 404 — token not found, already accepted, cancelled
//   INVITATION_EXPIRED  → 410 — expired, invite the user to request a new one
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { InvitationDetail } from '@/lib/types'

export const invitationDetailQueryKey = (token: string) =>
  ['invitations', token] as const

export function useGetInvitation(token: string) {
  return useQuery({
    queryKey: invitationDetailQueryKey(token),
    queryFn: () =>
      api
        .get<InvitationDetail>(`/invitations/${token}`)
        .then((res) => res.data),
    enabled: Boolean(token),
    // Never refetch — the token is immutable and valid/invalid at fetch time.
    // Subsequent visits to the same URL should show fresh state (staleTime: 0).
    staleTime: 0,
    retry: false,
  })
}