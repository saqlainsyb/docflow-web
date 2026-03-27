// src/hooks/useArchiveCard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mutation hooks for POST /cards/:id/archive and POST /cards/:id/unarchive.
//
// Both live in one file — they're always used together (archive toggle)
// and share identical structure. Splitting them would be artificial.
//
// Archived cards:
//   The backend excludes archived=true cards from GET /boards/:id, so
//   archiving a card makes it disappear from the board immediately after
//   the board query is invalidated. Unarchiving brings it back.
//
//   V1 has no "archived cards" view — that's a future module. For now,
//   archive is effectively a soft-delete from the board's perspective.
//
// No optimistic update — archive/unarchive are explicit user actions
// (not drag operations) and the loading state on the button is fine.
//
// On success:
//   Invalidate ['boards', boardId] so the card appears/disappears correctly.
//
// Backend error codes to handle at the callsite:
//   BOARD_ACCESS_DENIED → 403 — caller is not a board member
//   CARD_NOT_FOUND      → 404 — card was deleted by another user
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { ROUTES } from '@/lib/routes'
import { boardQueryKey } from '@/hooks/useBoard'

export function useArchiveCard(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (cardId: string) =>
      api
        .post(ROUTES.cards.archive(cardId))
        .then((res) => res.data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: boardQueryKey(boardId),
      })
    },
  })
}

export function useUnarchiveCard(boardId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (cardId: string) =>
      api
        .post(ROUTES.cards.unarchive(cardId))
        .then((res) => res.data),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: boardQueryKey(boardId),
      })
    },
  })
}