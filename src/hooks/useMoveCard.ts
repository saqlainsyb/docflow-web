// src/hooks/useMoveCard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /cards/:id/move — with optimistic updates.
//
// Why optimistic here but not in useUpdateCard:
//   Move operations happen via drag-and-drop. The card is already visually
//   in its new position (dnd-kit moved it in the DOM). If we waited for the
//   server round-trip, the card would snap back then jump to its new position
//   on success — a jarring flash. Optimistic updates eliminate that entirely.
//
//   Edit operations (useUpdateCard) happen in a modal with a submit button.
//   The user expects a loading state and a round-trip. No optimistic needed.
//
// Optimistic update strategy:
//   onMutate:
//     1. Cancel any in-flight board queries to prevent a racing refetch
//        overwriting our optimistic state mid-flight.
//     2. Snapshot the current board data for rollback on error.
//     3. Apply the move to the cached BoardDetailResponse:
//        Same-column: update the card's position in place, re-sort.
//        Cross-column: remove from source, insert into target, re-sort.
//     4. Return the snapshot as context for onError.
//
//   onError:
//     Restore the snapshot — the card snaps back to where it was.
//     Toast error so the user knows the move didn't save.
//
//   onSettled:
//     Always invalidate to sync with true server state after resolution.
//     After success this confirms our optimistic update matched reality.
//     After error the snapshot already restored, but we still sync.
//
// No success toast — firing a toast on every drag-and-drop would be noisy.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'
import type { BoardDetailResponse, MoveCardRequest } from '@/lib/types'

interface MoveCardPayload extends MoveCardRequest {
  cardId: string
}

export function useMoveCard(boardId: string) {
  const queryClient = useQueryClient()
  const qKey = boardQueryKey(boardId)

  return useMutation({
    mutationFn: ({ cardId, ...body }: MoveCardPayload) =>
      api
        .post(ROUTES.cards.move(cardId), body)
        .then((res) => res.data),

    onMutate: async ({ cardId, column_id: targetColumnId, position: newPosition }) => {
      // 1. Cancel in-flight refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: qKey })

      // 2. Snapshot current board state for rollback
      const previousBoard = queryClient.getQueryData<BoardDetailResponse>(qKey)

      // 3. Apply optimistic update
      if (previousBoard) {
        queryClient.setQueryData<BoardDetailResponse>(qKey, (old) => {
          if (!old) return old

          // Identify source column before any mutation
          const sourceColumnId = old.columns.find((col) =>
            col.cards.some((c) => c.id === cardId),
          )?.id

          if (!sourceColumnId) return old

          const isSameColumn = sourceColumnId === targetColumnId

          const updatedColumns = old.columns.map((col) => {
            if (isSameColumn && col.id === targetColumnId) {
              // Same-column reorder: update position in place, re-sort
              return {
                ...col,
                cards: col.cards
                  .map((c) =>
                    c.id === cardId ? { ...c, position: newPosition } : c,
                  )
                  .sort((a, b) => a.position - b.position),
              }
            }

            if (!isSameColumn && col.id === sourceColumnId) {
              // Cross-column move: remove card from source column
              return {
                ...col,
                cards: col.cards.filter((c) => c.id !== cardId),
              }
            }

            if (!isSameColumn && col.id === targetColumnId) {
              // Cross-column move: insert card into target column, re-sort
              const movingCard = old.columns
                .flatMap((c) => c.cards)
                .find((c) => c.id === cardId)!

              return {
                ...col,
                cards: [
                  ...col.cards,
                  { ...movingCard, column_id: targetColumnId, position: newPosition },
                ].sort((a, b) => a.position - b.position),
              }
            }

            return col
          })

          return { ...old, columns: updatedColumns }
        })
      }

      // 4. Return snapshot as rollback context
      return { previousBoard }
    },

    onError: (_err, _vars, context) => {
      // Restore the pre-drag board state on failure
      if (context?.previousBoard) {
        queryClient.setQueryData<BoardDetailResponse>(qKey, context.previousBoard)
      }
      toast.error("Couldn't move card — changes reverted")
    },

    onSettled: () => {
      // Always reconcile with server state after the mutation resolves
      queryClient.invalidateQueries({ queryKey: qKey })
    },
  })
}