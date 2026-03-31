// src/hooks/useDeleteBoard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for DELETE /boards/:id.
// On success: invalidates workspace boards list so sidebar reflects the deletion.
// The caller is responsible for navigating away after success.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'

export function useDeleteBoard(boardId: string, workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      api.delete(ROUTES.boards.delete(boardId)).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceBoards', workspaceId] })
    },
  })
}