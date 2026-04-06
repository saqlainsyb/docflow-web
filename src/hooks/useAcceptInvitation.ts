// src/hooks/useAcceptInvitation.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /api/v1/invitations/:token/accept.
// Requires authentication — the user must be logged in.
//
// On success:
//   - Invalidates ['workspaces'] so the sidebar workspace switcher reflects
//     the newly joined workspace immediately.
//   - Returns workspace_id so the caller can navigate there.
//
// Error codes the callsite should handle:
//   INVITATION_EMAIL_MISMATCH → 403 — logged-in user's email ≠ invitation email
//   INVITATION_INVALID        → 404 — already used / cancelled
//   INVITATION_EXPIRED        → 410 — past its expiry date
//   ALREADY_WORKSPACE_MEMBER  → 409 — already in the workspace (rare race)
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { workspacesQueryKey } from '@/hooks/useWorkspaces'
import type { AcceptInvitationResponse } from '@/lib/types'

export function useAcceptInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (token: string) =>
      api
        .post<AcceptInvitationResponse>(`/invitations/${token}/accept`)
        .then((res) => res.data),

    onSuccess: () => {
      // Refresh the workspace list so the new workspace appears in the sidebar.
      queryClient.invalidateQueries({ queryKey: workspacesQueryKey })
    },

    // onError intentionally absent — InvitationAcceptPage reads mutation.error
    // and renders a specific message based on the error code.
  })
}