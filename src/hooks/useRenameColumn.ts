// src/hooks/useRenameColumn.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for PATCH /columns/:id (title only).
// On success: invalidates the board query so the column title updates.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'

interface RenameColumnPayload {
  columnId: string
  title: string
}

export function useRenameColumn(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ columnId, title }: RenameColumnPayload) =>
      api.patch(ROUTES.columns.update(columnId), { title }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) })
      toast.success('Column renamed')
    },
    onError: () => {
      toast.error('Failed to rename column')
    },
  })
}