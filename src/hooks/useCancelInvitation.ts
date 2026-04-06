// src/hooks/useCancelInvitation.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for DELETE /workspaces/:id/invitations/:invitationId.
// Cancels a pending invitation so it can no longer be accepted.
// The backend flips status → 'cancelled'; the partial unique index is released
// so a fresh invite can be sent to the same email immediately.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { pendingInvitationsQueryKey } from '@/hooks/useSendInvitation'

export function useCancelInvitation(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (invitationId: string) =>
      api
        .delete(`/workspaces/${workspaceId}/invitations/${invitationId}`)
        .then((res) => res.data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: pendingInvitationsQueryKey(workspaceId),
      })
      toast.success('Invitation cancelled')
    },

    onError: () => {
      toast.error('Failed to cancel invitation')
    },
  })
}