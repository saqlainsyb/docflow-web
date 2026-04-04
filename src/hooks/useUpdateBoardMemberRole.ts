// src/hooks/useUpdateBoardMemberRole.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for PATCH /boards/:id/members/:uid.
//
// Changes a member's board role between 'admin' and 'editor'.
// Only the board owner can call this.
// To change the owner, use useTransferOwnership instead.
//
// On success: invalidates ['boards', boardId].
//
// Backend error codes:
//   INSUFFICIENT_PERMISSIONS  → 403 — caller is not board owner
//   CANNOT_REMOVE_BOARD_OWNER → 403 — tried to change owner's role via this endpoint
//   USER_NOT_FOUND            → 404
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'
import type { UpdateBoardMemberRoleRequest } from '@/lib/types'

interface UpdateBoardMemberRolePayload {
  userId: string
  role: UpdateBoardMemberRoleRequest['role']
}

export function useUpdateBoardMemberRole(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, role }: UpdateBoardMemberRolePayload) =>
      api
        .patch(ROUTES.boards.member(boardId, userId), { role })
        .then((r) => r.data),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) })
      toast.success('Role updated')
    },
    onError: () => {
      toast.error('Failed to update role')
    },
  })
}