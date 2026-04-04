// src/hooks/useRemoveBoardMember.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for DELETE /boards/:id/members/:uid.
//
// Removes an explicit board member.
// Requires board owner or admin.
// Backend enforces: cannot remove the board owner; admin cannot remove admin.
//
// On success: invalidates ['boards', boardId].
//
// Backend error codes:
//   CANNOT_REMOVE_BOARD_OWNER → 403
//   INSUFFICIENT_PERMISSIONS  → 403
//   USER_NOT_FOUND            → 404
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'

export function useRemoveBoardMember(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) =>
      api
        .delete(ROUTES.boards.member(boardId, userId))
        .then((r) => r.data),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) })
      toast.success('Member removed from board')
    },
    onError: () => {
      toast.error('Failed to remove member')
    },
  })
}