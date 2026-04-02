// src/hooks/useUpdateCard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for PATCH /cards/:id.
//
// Handles title edits, color changes, and assignee changes.
// All fields are optional — only the ones present in the payload are sent,
// matching backend PATCH semantics.
//
// No optimistic update — card edits happen inside a modal. The user
// submits, sees a loading state, and the modal closes on success.
// The round-trip latency is acceptable and avoids rollback complexity.
//
// On success:
//   Invalidate ['boards', boardId] to re-fetch the updated card in context.
//
// Backend error codes to handle at the callsite:
//   VALIDATION_ERROR    → 400 — title too long / invalid color
//   BOARD_ACCESS_DENIED → 403 — caller is not a board member
//   CARD_NOT_FOUND      → 404 — card was deleted by another user
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'
import type { CardResponse } from '@/lib/types'
import type { UpdateCardFormValues } from '@/lib/validations'

export function useUpdateCard(cardId: string, boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateCardFormValues) =>
      api
        .patch<CardResponse>(ROUTES.cards.update(cardId), payload)
        .then((res) => res.data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: boardQueryKey(boardId),
      })
      toast.success('Card updated')
    },
    onError: () => {
      toast.error('Failed to update card')
    },
  })
}