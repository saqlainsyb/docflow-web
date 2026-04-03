// src/hooks/useRevokeShareLink.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for DELETE /boards/:id/share-link.
//
// Sets the board's share_token to NULL on the server. Any request using
// the old token returns 404 immediately after this call succeeds.
//
// Auth: requires admin or owner workspace role (enforced by backend).
//
// On success:
//   Invalidate ['boards', boardId] to keep the cached board in sync.
//
// Backend error codes:
//   INSUFFICIENT_PERMISSIONS → 403 — caller is not admin/owner
//   BOARD_NOT_FOUND          → 404 — board was deleted by another user
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'

export function useRevokeShareLink(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation<void>({
    mutationFn: () =>
      api.delete(ROUTES.boards.shareLink(boardId)).then(() => undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) })
    },
    onError: () => {
      toast.error('Failed to revoke share link')
    },
  })
}