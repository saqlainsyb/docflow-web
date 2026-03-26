// src/hooks/useChangeMemberRole.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for PATCH /workspaces/:id/members/:userId.
//
// Responsibilities:
// 1. PATCH the target member's role
// 2. On success: invalidate the workspace detail query so the role badge
//    in MembersPage updates immediately
//
// Payload shape: { role: 'admin' | 'member' }
//   'owner' is excluded — the backend rejects it and the UI never offers it.
//   AssignableRole from validations.ts enforces this at the type level.
//
// Cache strategy:
//   Invalidate ['workspaces', workspaceId] — same pattern as the other
//   member mutation hooks for consistency.
//
// Backend error codes to handle at the callsite:
//   INSUFFICIENT_PERMISSIONS → 403 — only owners can change roles
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { workspaceQueryKey } from '@/hooks/useWorkspace'
import type { AssignableRole } from '@/lib/validations'

interface ChangeMemberRolePayload {
  userId: string
  role: AssignableRole
}

export function useChangeMemberRole(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, role }: ChangeMemberRolePayload) =>
      api
        .patch(ROUTES.workspaces.member(workspaceId, userId), { role })
        .then((res) => res.data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: workspaceQueryKey(workspaceId),
      })
    },
  })
}