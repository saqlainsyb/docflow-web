// src/hooks/useReorderColumn.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for PATCH /columns/:id (position only).
//
// Called by BoardPage after a column drag ends — sends the computed fractional
// index position to the backend. The backend broadcasts COLUMN_REORDERED over
// the board WebSocket, so every connected client updates their sort order
// without a full re-fetch.
//
// Optimistic update (onMutate):
//   Patches the React Query cache immediately with the new position + resort
//   so the board reflects the new order the instant localColumns is cleared in
//   BoardPage — no snap-back, no waiting for the WS event. Mirrors exactly
//   what useMoveCard does for cards.
//
// Rollback (onError):
//   Restores the pre-drag cache snapshot so the board snaps back to the
//   server-confirmed order if the API call fails.
//
// onSuccess:
//   Invalidates the board query as a safety net in case the WS event arrives
//   before the mutation resolves (rare but possible under network lag).
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'
import type { BoardDetailResponse } from '@/lib/types'

interface ReorderColumnPayload {
  columnId: string
  position: number
}

export function useReorderColumn(boardId: string) {
  const queryClient = useQueryClient()
  const qKey = boardQueryKey(boardId)

  return useMutation({
    mutationFn: ({ columnId, position }: ReorderColumnPayload) =>
      api
        .patch(ROUTES.columns.update(columnId), { position })
        .then((r) => r.data),

    // ── Optimistic update ────────────────────────────────────────────────────
    // Patch the cache immediately so the board shows the new column order the
    // moment BoardPage calls setLocalColumns(null) — identical to the WS
    // COLUMN_REORDERED handler logic so both paths produce the same result.
    onMutate: async ({ columnId, position }) => {
      // Cancel in-flight refetches that could overwrite our optimistic write.
      await queryClient.cancelQueries({ queryKey: qKey })

      // Snapshot the current value for rollback on error.
      const previous = queryClient.getQueryData<BoardDetailResponse>(qKey)

      // Apply optimistic update — patch position and re-sort, same as the
      // COLUMN_REORDERED WS handler in useBoardWebSocket.
      queryClient.setQueryData<BoardDetailResponse>(qKey, (old) => {
        if (!old) return old
        return {
          ...old,
          columns: old.columns
            .map((col) =>
              col.id === columnId ? { ...col, position } : col,
            )
            .sort((a, b) => a.position - b.position),
        }
      })

      return { previous }
    },

    onError: (_err, _vars, context) => {
      // Roll back to the pre-drag snapshot so the board shows the real order.
      if (context?.previous) {
        queryClient.setQueryData(qKey, context.previous)
      }
      toast.error('Failed to reorder column')
    },

    onSuccess: () => {
      // The WS COLUMN_REORDERED event will arrive shortly and confirm the
      // update — invalidateQueries is the safety net in case WS is delayed.
      queryClient.invalidateQueries({ queryKey: qKey })
    },
  })
}