// src/hooks/useCreateCard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /columns/:id/cards.
//
// The caller computes the position via fractional.after() against the last
// card in the column before calling mutate(). This keeps position logic
// in one place (the component/hook that owns the column state) rather than
// scattered across creation hooks.
//
// On success:
//   Invalidate ['boards', boardId] — cards are nested inside the board
//   query response, so we re-fetch the full board to get the new card
//   in its correct column with the correct position.
//
// Backend error codes to handle at the callsite:
//   VALIDATION_ERROR    → 400 — title empty or too long
//   BOARD_ACCESS_DENIED → 403 — caller is not a board member
//   BOARD_NOT_FOUND     → 404 — stale boardId (column's board was deleted)
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'
import type { CardResponse } from '@/lib/types'

interface CreateCardPayload {
  title: string
  position: number
  color?: string
}

export function useCreateCard(columnId: string, boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateCardPayload) =>
      api
        .post<CardResponse>(ROUTES.cards.create(columnId), payload)
        .then((res) => res.data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: boardQueryKey(boardId),
      })
      toast.success('Card created')
    },
    onError: () => {
      toast.error('Failed to create card')
    },
  })
}