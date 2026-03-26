// src/hooks/useRemoveMember.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for DELETE /workspaces/:id/members/:userId.
//
// Responsibilities:
// 1. DELETE the member from the workspace
// 2. On success: invalidate the workspace detail query so the member
//    disappears from MembersPage without a manual refresh
//
// Cache strategy:
//   Same as useInviteMember — invalidate ['workspaces', workspaceId] only.
//   The workspace list doesn't change when a member is removed.
//
// Backend rules enforced server-side (not duplicated here):
//   - Cannot remove the workspace owner
//   - Admin cannot remove another admin — only owner can
//   - Requires admin or owner role
//
// Backend error codes to handle at the callsite:
//   INSUFFICIENT_PERMISSIONS → 403
//   NOT_WORKSPACE_MEMBER     → 404 (member already removed — treat as success)
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { workspaceQueryKey } from '@/hooks/useWorkspace'

export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) =>
      api
        .delete(ROUTES.workspaces.member(workspaceId, userId))
        .then((res) => res.data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceQueryKey(workspaceId),
      })
    },
  })
}