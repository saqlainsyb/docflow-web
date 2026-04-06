// src/hooks/useSendInvitation.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /workspaces/:id/invitations.
//
// Replaces the old useInviteMember for the email invite flow.
// The backend now sends a Resend email instead of doing an immediate
// AddMember — the invitee accepts via the email link.
//
// On success:
//   - Invalidates the pending invitations list so the MembersPage table
//     refreshes and shows the new pending row immediately.
//   - Does NOT invalidate the members list — the user isn't a member yet.
//
// Backend error codes to handle at the callsite:
//   INVITATION_ALREADY_PENDING → 409 — live pending invite already exists
//   ALREADY_WORKSPACE_MEMBER   → 409 — email is already a member
//   INSUFFICIENT_PERMISSIONS   → 403 — caller is not admin or owner
//   EMAIL_DELIVERY_FAILED      → 202 — invite created, email failed (non-fatal)
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import type { SendInvitationResponse } from '@/lib/types'

export const pendingInvitationsQueryKey = (workspaceId: string) =>
  ['workspaces', workspaceId, 'invitations'] as const

export interface SendInvitationValues {
  email: string
  role: 'admin' | 'member'
}

export function useSendInvitation(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: SendInvitationValues) =>
      api
        .post<SendInvitationResponse>(
          `/workspaces/${workspaceId}/invitations`,
          values,
        )
        .then((res) => res.data),

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: pendingInvitationsQueryKey(workspaceId),
      })
      toast.success(`Invitation sent to ${variables.email}`)
    },

    onError: () => {
      // Callsite reads mutation.error for domain-specific messages.
      // Generic fallback toast here covers network errors.
      toast.error('Failed to send invitation')
    },
  })
}