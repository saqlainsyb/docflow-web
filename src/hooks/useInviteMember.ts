// src/hooks/useInviteMember.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /workspaces/:id/members.
//
// Responsibilities:
// 1. POST the invitee's email to the backend
//    Backend resolves the user by email — user must already have an account (V1)
// 2. On success: invalidate the workspace detail query so MembersPage
//    re-renders with the new member in the table immediately
//
// Cache strategy:
//   Invalidate ['workspaces', workspaceId] — targets the detail query only.
//   The list query ['workspaces'] doesn't need to change since adding a member
//   doesn't affect the workspace's own fields (name, owner_id etc.).
//
// Backend error codes to handle at the callsite:
//   USER_NOT_FOUND          → 404 — no account with that email
//   ALREADY_WORKSPACE_MEMBER → 409 — already a member
//   INSUFFICIENT_PERMISSIONS → 403 — caller is not admin or owner
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { workspaceQueryKey } from '@/hooks/useWorkspace'
import type { InviteMemberFormValues } from '@/lib/validations'

export function useInviteMember(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: InviteMemberFormValues) =>
      api
        .post(ROUTES.workspaces.members(workspaceId), values)
        .then((res) => res.data),

    onSuccess: () => {
      // Refetch the workspace detail — members array is embedded in it
      queryClient.invalidateQueries({
        queryKey: workspaceQueryKey(workspaceId),
      })
    },
  })
}