// src/hooks/useAddBoardMember.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /boards/:id/members.
//
// Adds a user to a board with a specified role (defaults to 'editor').
// Requires board owner or admin. Admins can only add editors.
//
// On success: invalidates ['boards', boardId] so the members list
// in BoardDetailResponse updates immediately.
//
// Backend error codes to handle at the callsite:
//   ALREADY_BOARD_MEMBER     → 409
//   INSUFFICIENT_PERMISSIONS → 403 — caller is not board owner/admin
//   USER_NOT_FOUND           → 404 — target is not a workspace member
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'
import type { AddBoardMemberRequest } from '@/lib/types'

export function useAddBoardMember(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: AddBoardMemberRequest) =>
      api
        .post(ROUTES.boards.members(boardId), payload)
        .then((r) => r.data),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) })
      toast.success('Member added to board')
    },
    onError: () => {
      toast.error('Failed to add member')
    },
  })
}