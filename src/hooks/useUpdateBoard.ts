// src/hooks/useUpdateBoard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for PATCH /boards/:id.
// Handles title and visibility updates.
// On success: invalidates ['boards', boardId] to reflect the updated title.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'

interface UpdateBoardPayload {
  title?: string
  visibility?: 'workspace' | 'private'
}

export function useUpdateBoard(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateBoardPayload) =>
      api.patch(ROUTES.boards.update(boardId), payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) })
      toast.success('Board updated')
    },
    onError: () => {
      toast.error('Failed to update board')
    },
  })
}