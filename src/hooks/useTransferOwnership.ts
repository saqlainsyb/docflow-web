// src/hooks/useTransferOwnership.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /boards/:id/transfer.
//
// Transfers board ownership to another existing board member.
// Only the current board owner can call this.
// The previous owner is atomically downgraded to 'admin' on the backend.
// The new owner must already be a board member.
//
// On success: invalidates ['boards', boardId] so my_board_role updates
// immediately — the caller's role changes from 'owner' to 'admin'.
//
// Backend error codes:
//   INSUFFICIENT_PERMISSIONS → 403 — caller is not board owner
//   TARGET_NOT_BOARD_MEMBER  → 422 — target must be added first
//   USER_NOT_FOUND           → 404
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'
import type { TransferOwnershipRequest } from '@/lib/types'

export function useTransferOwnership(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: TransferOwnershipRequest) =>
      api
        .post(ROUTES.boards.transfer(boardId), payload)
        .then((r) => r.data),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) })
      toast.success('Ownership transferred successfully')
    },
    onError: () => {
      toast.error('Failed to transfer ownership')
    },
  })
}