// src/hooks/useDeleteColumn.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for DELETE /columns/:id.
//
// The backend cascades the delete to all cards in the column — there is no
// "move cards first" step. The UI (Column.tsx) is responsible for showing
// a confirmation before calling mutate() so the user understands cards
// will be lost.
//
// On success:
//   Invalidate ['boards', boardId] — the column disappears from the board
//   query and the remaining columns re-render in their existing order.
//
// No optimistic update — deletion is destructive and irreversible. We wait
// for the server to confirm before removing the column from the UI. The
// brief loading state on the confirm button is the correct UX here.
//
// Backend error codes to handle at the callsite:
//   BOARD_ACCESS_DENIED → 403 — caller is not a board member
//   BOARD_NOT_FOUND     → 404 — stale boardId
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'

export function useDeleteColumn(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (columnId: string) =>
      api
        .delete(ROUTES.columns.delete(columnId))
        .then((res) => res.data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: boardQueryKey(boardId),
      })
    },
  })
}