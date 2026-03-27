// src/hooks/useCreateColumn.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hook for POST /boards/:id/columns.
//
// The caller is responsible for computing the position using fractional.ts
// before calling mutate(). This hook stays position-agnostic — it just
// sends whatever it receives.
//
// On success:
//   Invalidate ['boards', boardId] — the board query owns the full
//   column + card tree, so invalidating it re-fetches the latest state
//   including the newly created column.
//
// Backend error codes to handle at the callsite:
//   VALIDATION_ERROR    → 400 — title empty or too long
//   BOARD_ACCESS_DENIED → 403 — caller is not a board member
//   BOARD_NOT_FOUND     → 404 — stale boardId
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'
import type { ColumnResponse } from '@/lib/types'

interface CreateColumnPayload {
  title: string
  position: number
}

export function useCreateColumn(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateColumnPayload) =>
      api
        .post<ColumnResponse>(ROUTES.columns.create(boardId), payload)
        .then((res) => res.data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: boardQueryKey(boardId),
      })
    },
  })
}