// src/hooks/useDeleteCard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for DELETE /cards/:id.
//
// Permanently removes a card and its associated document.
// The UI (Card.tsx context menu or EditCard modal) should confirm before
// calling mutate() — deletion is irreversible.
//
// On success:
//   Invalidate ['boards', boardId] so the card disappears from its column.
//
// No optimistic update — same reasoning as useDeleteColumn. Destructive
// operations wait for server confirmation before updating the UI.
//
// Backend error codes to handle at the callsite:
//   BOARD_ACCESS_DENIED → 403 — caller is not a board member
//   CARD_NOT_FOUND      → 404 — card already deleted (treat as success)
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'

export function useDeleteCard(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (cardId: string) =>
      api
        .delete(ROUTES.cards.delete(cardId))
        .then((res) => res.data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: boardQueryKey(boardId),
      })
      toast.success('Card deleted')
    },
    onError: () => {
      toast.error('Failed to delete card')
    },
  })
}