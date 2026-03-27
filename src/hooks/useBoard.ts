// src/hooks/useBoard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Query hook for GET /boards/:id.
//
// Returns the full BoardDetailResponse — board metadata, all columns,
// and all non-archived cards nested inside their columns.
//
// This is the single source of truth for BoardPage. All mutations
// (createColumn, createCard, moveCard, etc.) invalidate this key so the
// board stays consistent after every operation.
//
// select:
//   Sorts columns by position asc, and each column's cards by position asc.
//   The backend already returns them in this order, but enforcing it in
//   select makes BoardPage immune to any future backend sort changes and
//   ensures the DnD optimistic state stays correctly ordered after updates.
//
// enabled:
//   Disabled when boardId is undefined (useParams returns string | undefined).
// ─────────────────────────────────────────────────────────────────────────────

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import type { BoardDetailResponse } from '@/lib/types'

// ── Query key factory ─────────────────────────────────────────────────────────
// Exported so all board mutation hooks can invalidate without importing
// this hook. Using the factory keeps keys consistent everywhere.

export const boardQueryKey = (id: string) => ['boards', id] as const

export function useBoard(boardId: string | undefined) {
  return useQuery({
    queryKey: boardQueryKey(boardId ?? ''),

    queryFn: () =>
      api
        .get<BoardDetailResponse>(ROUTES.boards.detail(boardId!))
        .then((res) => res.data),

    // Sort columns and their cards by position so BoardPage can render
    // directly without any additional sorting at the component level.
    select: (data) => ({
      ...data,
      columns: [...data.columns]
        .sort((a, b) => a.position - b.position)
        .map((col) => ({
          ...col,
          cards: [...col.cards].sort((a, b) => a.position - b.position),
        })),
    }),

    enabled: Boolean(boardId),
  })
}