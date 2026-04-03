// src/hooks/useGenerateShareLink.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /boards/:id/share-link.
//
// Calls the backend to generate (or replace) the board's public share token.
// Returns { url, token } — the caller stores the URL in local state and
// shows it in the ShareBoardDialog so the user can copy it.
//
// Overwrites any existing token — old links stop working immediately.
//
// Auth: requires admin or owner workspace role (enforced by backend).
//
// On success:
//   Invalidate ['boards', boardId] so the cached board reflects the new
//   share_token if it is ever added to BoardDetailResponse in the future.
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
import type { ShareLinkResponse } from '@/lib/types'

export function useGenerateShareLink(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation<ShareLinkResponse>({
    mutationFn: () =>
      api
        .post<ShareLinkResponse>(ROUTES.boards.shareLink(boardId))
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) })
    },
    onError: () => {
      toast.error('Failed to generate share link')
    },
  })
}